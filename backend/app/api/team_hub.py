"""Team Hub: salespeople's WhatsApp assistant numbers, their tasks, and per-person stats."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_manager, require_writer
from app.models.contact import Contact
from app.models.sales_task import SalesTask
from app.models.tenant import Tenant, TenantMembership, User
from app.models.whatsapp_account import WhatsAppAccount
from app.services import team_hub
from app.services.ai import agent as ai_agent
from app.services.phone import InvalidPhone, normalize_phone

router = APIRouter(prefix="/team-hub", tags=["team-hub"])

Kind = Literal["call", "follow_up", "meeting", "other"]


async def _tenant(db: AsyncSession, ctx: Ctx) -> Tenant:
    t = await db.get(Tenant, ctx.tenant_id)
    assert t is not None
    return t


@router.get("/overview")
async def overview(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    tenant = await _tenant(db, ctx)
    tz = team_hub.tenant_tz(tenant)
    rows = (await db.execute(select(TenantMembership, User).join(User, User.id == TenantMembership.user_id)
                             .where(TenantMembership.tenant_id == ctx.tenant_id).order_by(TenantMembership.created_at))).all()
    numbers = (await db.execute(select(WhatsAppAccount.display_phone_number, WhatsAppAccount.verified_name).where(
        WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status != "disconnected"))).all()
    members = []
    for m, u in rows:
        members.append({"user_id": str(u.id), "name": u.full_name or u.email.split("@")[0], "email": u.email, "role": m.role, "is_you": u.id == ctx.user_id,
                        "active": u.is_active, "whatsapp_phone": m.whatsapp_phone, "assistant_enabled": m.assistant_enabled,
                        "stats": await team_hub.stats_for(db, ctx.tenant_id, u.id, tz)})
    return {"members": members, "business_numbers": [{"phone": p, "name": n} for p, n in numbers if p],
            "settings": team_hub.hub_settings(tenant), "ai_enabled": ai_agent.get_config(tenant)["enabled"], "timezone": str(tz),
            "can_manage": ctx.is_manager}


class MemberIn(BaseModel):
    whatsapp_phone: str | None = Field(default=None, max_length=32)
    assistant_enabled: bool | None = None


@router.patch("/members/{user_id}")
async def update_member(user_id: uuid.UUID, body: MemberIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    """Members set their own number; owners/admins can set anyone's."""
    if user_id != ctx.user_id and not ctx.is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "Only owners and admins can change another member's number."})
    m = (await db.execute(select(TenantMembership).where(TenantMembership.tenant_id == ctx.tenant_id, TenantMembership.user_id == user_id))).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail={"error": "Team member not found."})
    fields = body.model_dump(exclude_unset=True)
    if "whatsapp_phone" in fields:
        raw = (body.whatsapp_phone or "").strip()
        if not raw:
            m.whatsapp_phone = None
        else:
            tenant = await _tenant(db, ctx)
            try:
                phone = normalize_phone(raw, str((tenant.settings or {}).get("default_country_code") or "91"))
            except InvalidPhone as exc:
                raise HTTPException(status_code=422, detail={"error": str(exc)})
            business = {"".join(ch for ch in (p or "") if ch.isdigit()) for p in (await db.execute(select(WhatsAppAccount.display_phone_number).where(
                WhatsAppAccount.tenant_id == ctx.tenant_id))).scalars()}
            if phone in business:
                raise HTTPException(status_code=422, detail={"error": "That's the business WhatsApp number. Enter the salesperson's own number."})
            taken = (await db.execute(select(TenantMembership.id).where(TenantMembership.tenant_id == ctx.tenant_id, TenantMembership.whatsapp_phone == phone,
                                                                       TenantMembership.id != m.id))).first()
            if taken:
                raise HTTPException(status_code=409, detail={"error": "Another team member already uses this number."})
            m.whatsapp_phone = phone
    if body.assistant_enabled is not None:
        m.assistant_enabled = body.assistant_enabled
    await db.commit()
    return {"user_id": str(user_id), "whatsapp_phone": m.whatsapp_phone, "assistant_enabled": m.assistant_enabled}


class SettingsIn(BaseModel):
    daily_summary: bool = True
    summary_hour: int = Field(default=9, ge=0, le=23)


@router.put("/settings")
async def update_settings(body: SettingsIn, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    tenant = await _tenant(db, ctx)
    tenant.settings = {**(tenant.settings or {}), "team_hub": body.model_dump()}
    await db.commit()
    return team_hub.hub_settings(tenant)


# ---- tasks ----------------------------------------------------------------------------------------------------------------

@router.get("/tasks")
async def list_tasks(user_id: uuid.UUID | None = None, status_: Literal["open", "done", "all"] = Query("open", alias="status"),
                     scope: Literal["all", "today", "overdue", "upcoming"] = "all", q: str | None = None,
                     ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    tenant = await _tenant(db, ctx)
    tz = team_hub.tenant_tz(tenant)
    query = (select(SalesTask, Contact, User).outerjoin(Contact, Contact.id == SalesTask.contact_id).outerjoin(User, User.id == SalesTask.user_id)
             .where(SalesTask.tenant_id == ctx.tenant_id))
    if user_id:
        query = query.where(SalesTask.user_id == user_id)
    if status_ != "all":
        query = query.where(SalesTask.status == status_)
    if scope == "today":
        query = query.where(or_(SalesTask.due_at.is_(None), SalesTask.due_at <= team_hub.end_of_today(tz)))
    elif scope == "overdue":
        query = query.where(SalesTask.due_at < team_hub.utcnow(), SalesTask.status == "open")
    elif scope == "upcoming":
        query = query.where(SalesTask.due_at > team_hub.end_of_today(tz))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(SalesTask.title.ilike(like), Contact.name.ilike(like), Contact.phone.contains(q.strip())))
    order = (SalesTask.done_at.desc(),) if status_ == "done" else (SalesTask.due_at.asc().nulls_last(), SalesTask.created_at.desc())
    rows = (await db.execute(query.order_by(*order).limit(300))).all()
    return {"items": [team_hub.task_out(t, c, u) for t, c, u in rows]}


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: Kind = "call"
    user_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    due_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


async def _check_refs(db: AsyncSession, ctx: Ctx, user_id: uuid.UUID | None, contact_id: uuid.UUID | None) -> None:
    if user_id and not (await db.execute(select(TenantMembership.id).where(TenantMembership.tenant_id == ctx.tenant_id, TenantMembership.user_id == user_id))).first():
        raise HTTPException(status_code=422, detail={"error": "That person isn't on this team."})
    if contact_id:
        c = await db.get(Contact, contact_id)
        if c is None or c.tenant_id != ctx.tenant_id:
            raise HTTPException(status_code=422, detail={"error": "Contact not found."})


async def _task(db: AsyncSession, ctx: Ctx, task_id: uuid.UUID) -> SalesTask:
    t = await db.get(SalesTask, task_id)
    if t is None or t.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Task not found."})
    return t


async def _out(db: AsyncSession, t: SalesTask) -> dict:
    return team_hub.task_out(t, await db.get(Contact, t.contact_id) if t.contact_id else None, await db.get(User, t.user_id) if t.user_id else None)


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    owner = body.user_id or ctx.user_id
    await _check_refs(db, ctx, owner, body.contact_id)
    t = await team_hub.create_task(db, ctx.tenant_id, title=body.title, kind=body.kind, user_id=owner, created_by=ctx.user_id,
                                   contact_id=body.contact_id, due_at=body.due_at, notes=body.notes)
    await db.commit()
    return await _out(db, t)


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: Kind | None = None
    user_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    due_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)
    status: Literal["open", "done"] | None = None


@router.patch("/tasks/{task_id}")
async def update_task(task_id: uuid.UUID, body: TaskPatch, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    t = await _task(db, ctx, task_id)
    fields = body.model_dump(exclude_unset=True)
    await _check_refs(db, ctx, fields.get("user_id"), fields.get("contact_id"))
    for k in ("title", "kind", "user_id", "contact_id", "due_at", "notes"):
        if k in fields:
            setattr(t, k, fields[k])
    if fields.get("status") == "done" and t.status != "done":
        team_hub.mark_done(t)
    elif fields.get("status") == "open":
        t.status, t.done_at = "open", None
    await db.commit()
    return await _out(db, t)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_task(task_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> None:
    await db.delete(await _task(db, ctx, task_id))
    await db.commit()
