"""Follow-up sequences: CRUD, enrolling contacts, progress, and the silent-leads recovery list."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import Ctx, get_ctx, get_db, require_writer
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.followup import FollowupEnrollment, FollowupSequence
from app.models.template import WhatsAppTemplate
from app.services import followups as svc

router = APIRouter(prefix="/followups", tags=["followups"])

STATUSES = ("active", "replied", "completed", "stopped", "failed")


class StepIn(BaseModel):
    kind: Literal["template", "text", "ai"]
    delay_minutes: int = Field(ge=0, le=svc.MAX_DELAY_MINUTES)
    template_id: uuid.UUID | None = None
    variables: dict = Field(default_factory=dict)
    text: str = Field(default="", max_length=1000)
    instructions: str = Field(default="", max_length=500)
    fallback_template_id: uuid.UUID | None = None


class SequenceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    active: bool = True
    trigger: Literal["manual", "tag", "new_lead"] = "manual"
    trigger_value: str | None = Field(default=None, max_length=100)
    business_hours_only: bool = False
    steps: list[StepIn] = Field(min_length=1, max_length=svc.MAX_STEPS)


class EnrollIn(BaseModel):
    contact_ids: list[uuid.UUID] = Field(min_length=1, max_length=5000)


async def _counts(db: AsyncSession, seq_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, int]]:
    out: dict[uuid.UUID, dict[str, int]] = {i: {s: 0 for s in STATUSES} for i in seq_ids}
    if seq_ids:
        rows = await db.execute(select(FollowupEnrollment.sequence_id, FollowupEnrollment.status, func.count())
                                .where(FollowupEnrollment.sequence_id.in_(seq_ids)).group_by(FollowupEnrollment.sequence_id, FollowupEnrollment.status))
        for sid, st, n in rows:
            out[sid][st] = n
    return out


def _out(s: FollowupSequence, counts: dict[str, int]) -> dict:
    total = sum(counts.values())
    finished = counts["replied"] + counts["completed"]
    return {
        "id": str(s.id), "name": s.name, "active": s.active, "trigger": s.trigger, "trigger_value": s.trigger_value,
        "business_hours_only": s.business_hours_only, "steps": s.steps, "counts": counts, "enrolled": total,
        "reply_rate": round(counts["replied"] / finished, 3) if finished else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


async def _owned(db: AsyncSession, ctx: Ctx, seq_id: uuid.UUID) -> FollowupSequence:
    s = await db.get(FollowupSequence, seq_id)
    if s is None or s.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Follow-up sequence not found."})
    return s


async def _validated(db: AsyncSession, ctx: Ctx, body: SequenceIn) -> list[dict]:
    if body.trigger == "tag" and not (body.trigger_value or "").strip():
        raise HTTPException(status_code=422, detail={"error": "Choose the tag that starts this sequence."})
    try:
        steps = svc.validate_steps([st.model_dump(mode="json") for st in body.steps])
    except svc.FollowupError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc)})
    ids = {uuid.UUID(x) for st in steps for x in (st["template_id"], st["fallback_template_id"]) if x}
    if ids:
        ok = set((await db.execute(select(WhatsAppTemplate.id).where(WhatsAppTemplate.tenant_id == ctx.tenant_id, WhatsAppTemplate.id.in_(ids)))).scalars())
        if ids - ok:
            raise HTTPException(status_code=422, detail={"error": "One of the chosen templates doesn't exist in this workspace."})
    return steps


@router.get("")
async def list_sequences(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.execute(select(FollowupSequence).where(FollowupSequence.tenant_id == ctx.tenant_id).order_by(FollowupSequence.created_at.desc()))).scalars().all()
    counts = await _counts(db, [s.id for s in rows])
    return [_out(s, counts[s.id]) for s in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sequence(body: SequenceIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    steps = await _validated(db, ctx, body)
    s = FollowupSequence(tenant_id=ctx.tenant_id, name=body.name.strip(), active=body.active, trigger=body.trigger,
                         trigger_value=(body.trigger_value or "").strip() or None, business_hours_only=body.business_hours_only, steps=steps)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _out(s, (await _counts(db, [s.id]))[s.id])


@router.get("/silent")
async def silent_leads(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db), limit: int = 200) -> list[dict]:
    """Leads who finished a sequence without replying and haven't written since: the recovery list."""
    later_reply = exists().where(Conversation.contact_id == FollowupEnrollment.contact_id, Conversation.last_inbound_at > FollowupEnrollment.finished_at)
    other = aliased(FollowupEnrollment)
    newer = exists().where(and_(other.contact_id == Contact.id, other.status.in_(("active", "replied"))))
    rows = (await db.execute(
        select(FollowupEnrollment, Contact, FollowupSequence.name)
        .join(Contact, Contact.id == FollowupEnrollment.contact_id).join(FollowupSequence, FollowupSequence.id == FollowupEnrollment.sequence_id)
        .where(FollowupEnrollment.tenant_id == ctx.tenant_id, FollowupEnrollment.status == "completed", ~later_reply, ~newer, Contact.opted_out.is_(False))
        .order_by(FollowupEnrollment.finished_at.desc()).limit(min(max(limit, 1), 500))
    )).all()
    seen: set[uuid.UUID] = set()
    out = []
    for e, c, seq_name in rows:
        if c.id in seen:
            continue
        seen.add(c.id)
        out.append({"contact_id": str(c.id), "name": c.name, "phone": c.phone, "lead_score": c.lead_score, "sequence": seq_name,
                    "sequence_id": str(e.sequence_id), "followups_sent": e.sent_count, "finished_at": e.finished_at.isoformat() if e.finished_at else None})
    return out


@router.get("/{seq_id}")
async def get_sequence(seq_id: uuid.UUID, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    s = await _owned(db, ctx, seq_id)
    return _out(s, (await _counts(db, [s.id]))[s.id])


@router.put("/{seq_id}")
async def update_sequence(seq_id: uuid.UUID, body: SequenceIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    s = await _owned(db, ctx, seq_id)
    steps = await _validated(db, ctx, body)
    s.name, s.active, s.trigger = body.name.strip(), body.active, body.trigger
    s.trigger_value, s.business_hours_only, s.steps = (body.trigger_value or "").strip() or None, body.business_hours_only, steps
    await db.commit()
    return _out(s, (await _counts(db, [s.id]))[s.id])


@router.delete("/{seq_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_sequence(seq_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> None:
    await db.delete(await _owned(db, ctx, seq_id))
    await db.commit()


@router.post("/{seq_id}/enroll")
async def enroll_contacts(seq_id: uuid.UUID, body: EnrollIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    s = await _owned(db, ctx, seq_id)
    if not s.active:
        raise HTTPException(status_code=409, detail={"error": "Turn this sequence on before adding contacts."})
    contacts = (await db.execute(select(Contact).where(Contact.tenant_id == ctx.tenant_id, Contact.id.in_(body.contact_ids)))).scalars().all()
    enrolled = 0
    for c in contacts:
        if await svc.enroll(db, s, c, source="manual"):
            enrolled += 1
    await db.commit()
    return {"enrolled": enrolled, "skipped": len(body.contact_ids) - enrolled}


@router.get("/{seq_id}/enrollments")
async def list_enrollments(seq_id: uuid.UUID, status_: str | None = Query(default=None, alias="status"), ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    await _owned(db, ctx, seq_id)
    q = select(FollowupEnrollment, Contact).join(Contact, Contact.id == FollowupEnrollment.contact_id).where(FollowupEnrollment.sequence_id == seq_id)
    if status_ in STATUSES:
        q = q.where(FollowupEnrollment.status == status_)
    rows = (await db.execute(q.order_by(FollowupEnrollment.created_at.desc()).limit(500))).all()
    return [{"id": str(e.id), "contact_id": str(c.id), "name": c.name, "phone": c.phone, "lead_score": c.lead_score, "status": e.status,
             "step": e.step_index, "sent": e.sent_count, "next_run_at": e.next_run_at.isoformat() if e.next_run_at else None,
             "finished_at": e.finished_at.isoformat() if e.finished_at else None, "source": e.source, "log": e.log, "error": e.last_error}
            for e, c in rows]


@router.post("/enrollments/{enrollment_id}/stop")
async def stop_enrollment(enrollment_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    e = await db.get(FollowupEnrollment, enrollment_id)
    if e is None or e.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Enrollment not found."})
    if e.status == "active":
        e.status, e.finished_at, e.next_run_at = "stopped", svc.utcnow(), None
        await db.commit()
    return {"status": e.status}
