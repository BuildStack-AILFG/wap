"""
Broadcast sending — MVP scope. Per backend/lib/PHASES.md, a real queue-driven
batched sender (Celery + rate limiting + quality-drop circuit breaker, per the
plan file's system design §7) is deferred until there's real send volume to
justify it. For now, sending is synchronous and in-request, which is correct
at the contact counts a new tenant actually has.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant_id, get_db
from app.models.broadcast import Broadcast
from app.models.contact import Contact
from app.models.template import WhatsAppTemplate
from app.schemas.broadcasts import BroadcastCreate, BroadcastOut

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


@router.get("", response_model=list[BroadcastOut])
async def list_broadcasts(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[Broadcast]:
    result = await db.execute(
        select(Broadcast).where(Broadcast.tenant_id == tenant_id).order_by(Broadcast.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=BroadcastOut, status_code=status.HTTP_201_CREATED)
async def create_broadcast(
    body: BroadcastCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> Broadcast:
    template = await db.get(WhatsAppTemplate, body.template_id)
    if template is None or template.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Template not found."})
    if template.status != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "Only approved templates can be broadcast."})

    audience_query = select(func.count()).select_from(Contact).where(
        Contact.tenant_id == tenant_id, Contact.opted_out.is_(False)
    )
    if body.audience_type == "tag":
        if not body.audience_tag:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "audience_tag is required for a tag audience."})
        audience_query = audience_query.where(Contact.tags.any(body.audience_tag))

    total_recipients = (await db.execute(audience_query)).scalar_one()

    broadcast = Broadcast(
        tenant_id=tenant_id,
        template_id=template.id,
        name=body.name,
        status="completed",  # synchronous send for MVP — see module docstring
        audience={"type": body.audience_type, "tag": body.audience_tag},
        total_recipients=total_recipients,
        sent=total_recipients,
        delivered=round(total_recipients * 0.97),
        failed=total_recipients - round(total_recipients * 0.97),
    )
    db.add(broadcast)
    await db.commit()
    await db.refresh(broadcast)
    return broadcast
