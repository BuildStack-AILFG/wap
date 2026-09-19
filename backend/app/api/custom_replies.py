from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant_id, get_db
from app.models.custom_reply import CustomReply
from app.schemas.custom_replies import CustomReplyCreate, CustomReplyOut, CustomReplyUpdate

router = APIRouter(prefix="/custom-replies", tags=["custom-replies"])


@router.get("", response_model=list[CustomReplyOut])
async def list_custom_replies(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[CustomReply]:
    result = await db.execute(
        select(CustomReply).where(CustomReply.tenant_id == tenant_id).order_by(CustomReply.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=CustomReplyOut, status_code=status.HTTP_201_CREATED)
async def create_custom_reply(
    body: CustomReplyCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> CustomReply:
    reply = CustomReply(tenant_id=tenant_id, trigger=body.trigger, reply_text=body.reply_text)
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return reply


async def _get_owned_reply(reply_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> CustomReply:
    reply = await db.get(CustomReply, reply_id)
    if reply is None or reply.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Custom reply not found."})
    return reply


@router.patch("/{reply_id}", response_model=CustomReplyOut)
async def update_custom_reply(
    reply_id: uuid.UUID,
    body: CustomReplyUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> CustomReply:
    reply = await _get_owned_reply(reply_id, tenant_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(reply, field, value)
    await db.commit()
    await db.refresh(reply)
    return reply


@router.delete("/{reply_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_custom_reply(
    reply_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    reply = await _get_owned_reply(reply_id, tenant_id, db)
    await db.delete(reply)
    await db.commit()
