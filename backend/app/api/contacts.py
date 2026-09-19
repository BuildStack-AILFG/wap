from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant_id, get_db
from app.models.contact import Contact
from app.schemas.contacts import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[Contact]:
    result = await db.execute(
        select(Contact).where(Contact.tenant_id == tenant_id).order_by(Contact.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(
    body: ContactCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> Contact:
    contact = Contact(
        tenant_id=tenant_id,
        name=body.name,
        phone=body.phone,
        email=body.email,
        tags=body.tags,
        source="manual",
    )
    db.add(contact)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error": "A contact with this phone number already exists."})
    await db.refresh(contact)
    return contact


async def _get_owned_contact(contact_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Contact:
    contact = await db.get(Contact, contact_id)
    if contact is None or contact.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Contact not found."})
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: uuid.UUID,
    body: ContactUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> Contact:
    contact = await _get_owned_contact(contact_id, tenant_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_contact(
    contact_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    contact = await _get_owned_contact(contact_id, tenant_id, db)
    await db.delete(contact)
    await db.commit()
