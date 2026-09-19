"""Broadcast campaigns: create (send now / schedule / draft), monitor, cancel, retry, export."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_writer
from app.models.broadcast import Broadcast, BroadcastRecipient
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant
from app.models.whatsapp_account import WhatsAppAccount
from app.services import broadcasts as svc
from app.services import quotas
from app.services.whatsapp.templates import required_variables

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


class AudienceIn(BaseModel):
    type: Literal["all_contacts", "tag", "segment", "csv", "numbers"]
    tag: str | None = None
    segment_id: uuid.UUID | None = None
    rows: list[dict] = Field(default_factory=list, max_length=20000)  # csv/numbers: [{phone, name?, <column>: value}]


class BroadcastCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    template_id: uuid.UUID
    account_id: uuid.UUID | None = None
    audience: AudienceIn
    variable_mapping: dict = Field(default_factory=dict)
    schedule_at: datetime | None = None
    send_now: bool = False


def _out(b: Broadcast, tpl: WhatsAppTemplate | None = None) -> dict:
    total = b.total_recipients or 0
    pct = lambda n: round(100 * n / total, 1) if total else 0.0  # noqa: E731
    return {
        "id": str(b.id), "name": b.name, "status": b.status, "template_id": str(b.template_id) if b.template_id else None, "template_name": tpl.name if tpl else None,
        "audience": {k: v for k, v in (b.audience or {}).items() if k != "rows"}, "scheduled_at": b.scheduled_at.isoformat() if b.scheduled_at else None,
        "started_at": b.started_at.isoformat() if b.started_at else None, "completed_at": b.completed_at.isoformat() if b.completed_at else None, "error": b.error,
        "total_recipients": total, "sent": b.sent, "delivered": b.delivered, "read": b.read, "replied": b.replied, "failed": b.failed,
        "delivered_pct": pct(b.delivered), "read_pct": pct(b.read), "replied_pct": pct(b.replied), "failed_pct": pct(b.failed),
        "created_at": b.created_at.isoformat() if b.created_at else None, "variable_mapping": b.variable_mapping or {},
    }


async def _owned(db: AsyncSession, ctx: Ctx, broadcast_id: uuid.UUID) -> Broadcast:
    b = await db.get(Broadcast, broadcast_id)
    if b is None or b.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Campaign not found."})
    return b


async def _default_cc(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    tenant = await db.get(Tenant, tenant_id)
    return str((tenant.settings or {}).get("default_country_code", "")) if tenant else ""


@router.get("")
async def list_broadcasts(status_: str | None = Query(None, alias="status"), ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    q = select(Broadcast, WhatsAppTemplate).outerjoin(WhatsAppTemplate, WhatsAppTemplate.id == Broadcast.template_id).where(Broadcast.tenant_id == ctx.tenant_id)
    if status_:
        q = q.where(Broadcast.status == status_)
    return [_out(b, t) for b, t in (await db.execute(q.order_by(Broadcast.created_at.desc()).limit(200))).all()]


@router.post("/preview-audience")
async def preview_audience(audience: AudienceIn, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    try:
        rows, skipped = await svc.resolve_audience(db, ctx.tenant_id, audience.model_dump(mode="json"), await _default_cc(db, ctx.tenant_id))
    except svc.BroadcastError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc)})
    result = {"count": len(rows), "skipped": skipped, "sample": [{"name": c.name, "phone": c.phone} for c, _ in rows[:5]]}
    await db.rollback()  # csv audiences upsert contacts while resolving — a preview must not keep them (read everything first: rollback expires objects)
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_broadcast(body: BroadcastCreate, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    tpl = await db.get(WhatsAppTemplate, body.template_id)
    if tpl is None or tpl.tenant_id != ctx.tenant_id or tpl.is_deleted:
        raise HTTPException(status_code=404, detail={"error": "Template not found."})
    if tpl.status != "approved":
        raise HTTPException(status_code=409, detail={"error": f"Only approved templates can be broadcast (this one is {tpl.status})."})
    q = select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status == "connected")
    if body.account_id:
        q = q.where(WhatsAppAccount.id == body.account_id)
    account = (await db.execute(q.order_by(WhatsAppAccount.created_at).limit(1))).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=409, detail={"error": "Connect a WhatsApp number before sending campaigns.", "code": "no_account"})
    if body.schedule_at and body.schedule_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail={"error": "Schedule time must be in the future."})

    audience = body.audience.model_dump(mode="json")
    b = Broadcast(tenant_id=ctx.tenant_id, template_id=tpl.id, account_id=account.id, name=body.name.strip(), status="draft", audience=audience,
                  variable_mapping=body.variable_mapping)
    db.add(b)
    await db.flush()
    try:
        skipped = await svc.create_recipients(db, b, tpl, await _default_cc(db, ctx.tenant_id))
    except svc.BroadcastError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail={"error": str(exc)})
    b.audience = {k: v for k, v in audience.items() if k != "rows"} | ({"row_count": len(audience["rows"])} if audience.get("rows") else {})
    await quotas.enforce(db, ctx.tenant_id, "max_broadcast_recipients_per_month", await svc.monthly_recipient_count(db, ctx.tenant_id), b.total_recipients, label="broadcast recipients per month")

    if body.schedule_at:
        b.status, b.scheduled_at = "scheduled", body.schedule_at
    elif body.send_now:
        b.status = "sending"
    await db.commit()
    if b.status == "sending":
        svc.start_in_background(b.id)
    return {**_out(b, tpl), "skipped": skipped}


@router.get("/{broadcast_id}")
async def get_broadcast(broadcast_id: uuid.UUID, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    b = await _owned(db, ctx, broadcast_id)
    tpl = await db.get(WhatsAppTemplate, b.template_id) if b.template_id else None
    return {**_out(b, tpl), "requires": required_variables(tpl) if tpl else None}


@router.get("/{broadcast_id}/recipients")
async def recipients(broadcast_id: uuid.UUID, status_: str | None = Query(None, alias="status"), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                     ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    b = await _owned(db, ctx, broadcast_id)
    cond = [BroadcastRecipient.broadcast_id == b.id]
    if status_:
        cond.append(BroadcastRecipient.status == status_)
    total = (await db.execute(select(func.count()).select_from(BroadcastRecipient).where(*cond))).scalar_one()
    rows = (await db.execute(select(BroadcastRecipient).where(*cond).order_by(BroadcastRecipient.created_at, BroadcastRecipient.id).limit(limit).offset(offset))).scalars().all()
    return {"total": total, "items": [{"id": str(r.id), "phone": r.phone, "status": r.status, "error": r.error, "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                                        "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None, "read_at": r.read_at.isoformat() if r.read_at else None,
                                        "replied": r.replied_at is not None} for r in rows]}


@router.post("/{broadcast_id}/start")
async def start(broadcast_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    b = await _owned(db, ctx, broadcast_id)
    if b.status not in {"draft", "scheduled"}:
        raise HTTPException(status_code=409, detail={"error": f"This campaign is already {b.status}."})
    b.status, b.scheduled_at = "sending", None
    await db.commit()
    svc.start_in_background(b.id)
    return _out(b)


@router.post("/{broadcast_id}/cancel")
async def cancel(broadcast_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    b = await _owned(db, ctx, broadcast_id)
    if b.status not in {"draft", "scheduled", "sending"}:
        raise HTTPException(status_code=409, detail={"error": f"This campaign is already {b.status}."})
    b.status, b.completed_at = "cancelled", datetime.now(timezone.utc)
    await db.commit()
    return _out(b)


@router.post("/{broadcast_id}/retry-failed")
async def retry(broadcast_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    b = await _owned(db, ctx, broadcast_id)
    if b.status not in {"completed", "failed"}:
        raise HTTPException(status_code=409, detail={"error": "Only finished campaigns can be retried."})
    n = await svc.retry_failed(db, b)
    if n:
        svc.start_in_background(b.id)
    return {"retrying": n}


@router.delete("/{broadcast_id}", status_code=204, response_model=None)
async def delete(broadcast_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> None:
    b = await _owned(db, ctx, broadcast_id)
    if b.status == "sending":
        raise HTTPException(status_code=409, detail={"error": "Cancel the campaign before deleting it."})
    await db.delete(b)
    await db.commit()


@router.get("/{broadcast_id}/export.csv")
async def export(broadcast_id: uuid.UUID, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    b = await _owned(db, ctx, broadcast_id)
    rows = (await db.execute(select(BroadcastRecipient).where(BroadcastRecipient.broadcast_id == b.id).order_by(BroadcastRecipient.created_at))).scalars().all()

    def generate():
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["phone", "status", "sent_at", "delivered_at", "read_at", "replied", "error"])
        yield buf.getvalue()
        for r in rows:
            buf.seek(0)
            buf.truncate()
            w.writerow([f"'+{r.phone}", r.status, r.sent_at or "", r.delivered_at or "", r.read_at or "", "yes" if r.replied_at else "no", (r.error or "").replace("=", "")])
            yield buf.getvalue()

    return StreamingResponse(generate(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="campaign-{b.id}.csv"'})
