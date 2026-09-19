"""Public REST API (v1), authenticated with an API key: `Authorization: Bearer lfg_live_...` or `X-API-Key`. Used by Zapier/Make/custom backends."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.developer import hash_key
from app.api.deps import get_db
from app.core import ratelimit
from app.models.contact import Contact
from app.models.integration import ApiKey
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant
from app.models.whatsapp_account import WhatsAppAccount
from app.services import quotas
from app.services.automation import events
from app.services.phone import InvalidPhone, normalize_phone
from app.services.whatsapp import messaging
from app.services.whatsapp.graph import GraphError
from app.services.whatsapp.templates import TemplateValidationError, build_send_components, render_preview, variables_in

router = APIRouter(prefix="/v1", tags=["public-api"])

RATE_PER_MINUTE = 300


async def api_tenant(request: Request, db: AsyncSession = Depends(get_db)) -> uuid.UUID:
    auth = request.headers.get("authorization", "")
    key = auth[7:].strip() if auth.lower().startswith("bearer ") else request.headers.get("x-api-key", "").strip()
    if not key.startswith("lfg_live_"):
        raise HTTPException(status_code=401, detail={"error": "Missing or invalid API key."}, headers={"WWW-Authenticate": "Bearer"})
    row = (await db.execute(select(ApiKey).where(ApiKey.key_hash == hash_key(key)))).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        raise HTTPException(status_code=401, detail={"error": "Missing or invalid API key."}, headers={"WWW-Authenticate": "Bearer"})
    if not ratelimit.allow(f"apikey:{row.id}", RATE_PER_MINUTE, 60):
        raise HTTPException(status_code=429, detail={"error": f"Rate limit exceeded ({RATE_PER_MINUTE} requests/minute)."}, headers={"Retry-After": "60"})
    now = datetime.now(timezone.utc)
    if row.last_used_at is None or now - row.last_used_at > timedelta(minutes=1):
        row.last_used_at = now
        await db.commit()
    return row.tenant_id


async def _cc(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    tenant = await db.get(Tenant, tenant_id)
    return str((tenant.settings or {}).get("default_country_code", "")) if tenant else ""


def _phone(raw: str, cc: str) -> str:
    try:
        return normalize_phone(raw, cc)
    except InvalidPhone as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc)})


class TemplateSend(BaseModel):
    name: str
    language: str = "en"
    body: list[str] = Field(default_factory=list)
    header_text: str | None = None
    header_media: str | None = None
    buttons: dict[str, str] = Field(default_factory=dict)


class MessageIn(BaseModel):
    to: str = Field(description="Recipient phone number with country code")
    type: Literal["text", "template"] = "template"
    text: str | None = Field(default=None, max_length=4096)
    template: TemplateSend | None = None
    callback_data: str | None = Field(default=None, max_length=512)


@router.post("/messages", status_code=201)
async def send_message(body: MessageIn, tenant_id: uuid.UUID = Depends(api_tenant), db: AsyncSession = Depends(get_db)) -> dict:
    phone = _phone(body.to, await _cc(db, tenant_id))
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == tenant_id, WhatsAppAccount.status == "connected").limit(1))).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=409, detail={"error": "No connected WhatsApp number.", "code": "no_account"})
    total = (await db.execute(select(func.count()).select_from(Contact).where(Contact.tenant_id == tenant_id))).scalar_one()
    if (await db.execute(select(Contact.id).where(Contact.tenant_id == tenant_id, Contact.phone == phone))).first() is None:
        await quotas.enforce(db, tenant_id, "max_contacts", total, label="contacts")
    contact, _ = await messaging.upsert_contact(db, tenant_id, phone, source="api")
    conv, _ = await messaging.get_or_create_conversation(db, account, contact)

    kwargs: dict = {}
    if body.type == "text":
        if not (body.text or "").strip():
            raise HTTPException(status_code=422, detail={"error": "'text' is required for type=text."})
        kwargs = {"kind": "text", "text": body.text}
    else:
        if body.template is None:
            raise HTTPException(status_code=422, detail={"error": "'template' is required for type=template."})
        t = body.template
        tpl = (await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == tenant_id, WhatsAppTemplate.name == t.name, WhatsAppTemplate.language == t.language,
                                                               WhatsAppTemplate.is_deleted.is_(False)))).scalar_one_or_none()
        if tpl is None or tpl.status != "approved":
            raise HTTPException(status_code=404, detail={"error": f"No approved template named '{t.name}' ({t.language})."})
        try:
            comps = build_send_components(tpl, body=t.body, header_text=t.header_text, header_media=t.header_media, buttons=t.buttons)
        except TemplateValidationError as exc:
            raise HTTPException(status_code=422, detail={"error": str(exc)})
        kwargs = {"kind": "template", "template_name": tpl.name, "template_language": tpl.language, "template_components": comps, "template_preview": render_preview(tpl, t.body),
                  "marketing": tpl.category == "MARKETING"}
    try:
        msg = await messaging.send_message(db, account, conv, contact, sender_type="api", callback_data=body.callback_data, **kwargs)
    except messaging.SendBlocked as exc:
        raise HTTPException(status_code=409, detail={"error": exc.message, "code": exc.code})
    except GraphError as exc:
        raise HTTPException(status_code=502, detail={"error": f"WhatsApp rejected the message: {exc}", "code": exc.code})
    return {"result": True, "id": str(msg.id), "wamid": msg.wamid, "status": msg.status}


class ContactUpsert(BaseModel):
    phone: str
    name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    tags: list[str] = Field(default_factory=list, max_length=50)
    traits: dict = Field(default_factory=dict)


@router.post("/contacts")
async def upsert_contact(body: ContactUpsert, tenant_id: uuid.UUID = Depends(api_tenant), db: AsyncSession = Depends(get_db)) -> dict:
    """Create or update a contact by phone. Tags are added (never removed); traits are merged."""
    phone = _phone(body.phone, await _cc(db, tenant_id))
    exists = (await db.execute(select(Contact.id).where(Contact.tenant_id == tenant_id, Contact.phone == phone))).first() is not None
    if not exists:
        total = (await db.execute(select(func.count()).select_from(Contact).where(Contact.tenant_id == tenant_id))).scalar_one()
        await quotas.enforce(db, tenant_id, "max_contacts", total, label="contacts")
    contact, created = await messaging.upsert_contact(db, tenant_id, phone, name=body.name, source="api", email=body.email)
    if body.name and not created:
        contact.name = body.name
    if body.email:
        contact.email = body.email
    seen = {t.lower() for t in (contact.tags or [])}
    contact.tags = [*(contact.tags or []), *[t.strip()[:50] for t in body.tags if t.strip() and t.strip().lower() not in seen]][:50]
    contact.custom_fields = {**(contact.custom_fields or {}), **body.traits}
    await db.commit()
    return {"result": True, "id": str(contact.id), "created": created}


class EventIn(BaseModel):
    phone: str
    event: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.\- ]+$")
    properties: dict = Field(default_factory=dict)


@router.post("/events", status_code=202)
async def track_event(body: EventIn, tenant_id: uuid.UUID = Depends(api_tenant), db: AsyncSession = Depends(get_db)) -> dict:
    phone = _phone(body.phone, await _cc(db, tenant_id))
    contact, _ = await messaging.upsert_contact(db, tenant_id, phone, source="api")
    return {"result": True, **await events.process(db, tenant_id, contact, body.event, body.properties, "api")}


@router.get("/contacts")
async def list_contacts(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), tenant_id: uuid.UUID = Depends(api_tenant), db: AsyncSession = Depends(get_db)) -> dict:
    rows = (await db.execute(select(Contact).where(Contact.tenant_id == tenant_id).order_by(Contact.created_at, Contact.id).limit(limit + 1).offset(offset))).scalars().all()
    return {"has_next_page": len(rows) > limit, "contacts": [{"id": str(c.id), "phone": c.phone, "name": c.name, "email": c.email, "tags": c.tags, "traits": c.custom_fields,
                                                            "opted_out": c.opted_out} for c in rows[:limit]]}


@router.get("/templates")
async def list_templates(tenant_id: uuid.UUID = Depends(api_tenant), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == tenant_id, WhatsAppTemplate.status == "approved", WhatsAppTemplate.is_deleted.is_(False)))).scalars().all()
    return [{"name": t.name, "language": t.language, "category": t.category, "body": t.body, "variables": len(variables_in(t.body))} for t in rows]
