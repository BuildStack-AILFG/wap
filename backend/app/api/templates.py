from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant_id, get_db
from app.models.template import WhatsAppTemplate
from app.schemas.templates import TemplateCreate, TemplateOut

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[WhatsAppTemplate]:
    result = await db.execute(
        select(WhatsAppTemplate)
        .where(WhatsAppTemplate.tenant_id == tenant_id, WhatsAppTemplate.is_deleted.is_(False))
        .order_by(WhatsAppTemplate.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> WhatsAppTemplate:
    template = WhatsAppTemplate(
        tenant_id=tenant_id,
        name=body.name,
        language=body.language,
        category=body.category,
        body=body.body,
        status="pending",
    )
    db.add(template)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "A template with this name and language already exists."},
        )
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_template(
    template_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    template = await db.get(WhatsAppTemplate, template_id)
    if template is None or template.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Template not found."})
    template.is_deleted = True
    await db.commit()
