"""Website widget management (authenticated). The public script/endpoints live in api/public.py."""

from __future__ import annotations

import re
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_manager
from app.models.widget import Widget
from app.models.whatsapp_account import WhatsAppAccount
from app.services.whatsapp.accounts import public_base

router = APIRouter(prefix="/widgets", tags=["widgets"])

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


class WidgetIn(BaseModel):
    name: str = Field(default="Website widget", min_length=1, max_length=200)
    enabled: bool = True
    phone_number: str = Field(default="", max_length=32)
    title: str = Field(default="Chat with us", max_length=120)
    subtitle: str = Field(default="Typically replies within minutes", max_length=200)
    welcome_message: str = Field(default="Hi there! How can we help you today?", max_length=600)
    prefill_message: str = Field(default="Hi, I have a question.", max_length=500)
    cta_text: str = Field(default="Start chat", max_length=60)
    brand_color: str = Field(default="#00926B")
    position: str = Field(default="right", pattern="^(left|right)$")
    bottom_offset: int = Field(default=24, ge=0, le=400)
    delay_seconds: int = Field(default=0, ge=0, le=120)
    collect_lead: bool = False
    allowed_domains: list[str] = Field(default_factory=list, max_length=20)


def _clean(body: WidgetIn, fallback_phone: str = "") -> dict:
    data = body.model_dump()
    if not HEX.match(data["brand_color"]):
        raise HTTPException(status_code=422, detail={"error": "Brand color must be a hex color like #00926B."})
    data["phone_number"] = re.sub(r"\D", "", data["phone_number"]) or fallback_phone
    if data["enabled"] and not 8 <= len(data["phone_number"]) <= 15:
        raise HTTPException(status_code=422, detail={"error": "Enter the WhatsApp number (with country code) the widget should open, e.g. 919876543210."})
    domains = []
    for d in data["allowed_domains"]:
        host = re.sub(r"^https?://", "", d.strip().lower()).split("/")[0]
        if host and re.fullmatch(r"[a-z0-9.\-*]+", host):
            domains.append(host)
        elif host:
            raise HTTPException(status_code=422, detail={"error": f"'{d}' is not a valid domain."})
    data["allowed_domains"] = domains
    return data


def _out(w: Widget, base: str) -> dict:
    src = f"{base}/api/public/widget/{w.public_key}.js"
    return {
        "id": str(w.id), "public_key": w.public_key, "name": w.name, "enabled": w.enabled, "phone_number": w.phone_number, "title": w.title, "subtitle": w.subtitle,
        "welcome_message": w.welcome_message, "prefill_message": w.prefill_message, "cta_text": w.cta_text, "brand_color": w.brand_color, "position": w.position,
        "bottom_offset": w.bottom_offset, "delay_seconds": w.delay_seconds, "collect_lead": w.collect_lead, "allowed_domains": w.allowed_domains or [],
        "opens": w.opens, "clicks": w.clicks, "leads": w.leads, "script_url": src, "embed_snippet": f'<script src="{src}" async></script>',
        "click_to_chat_url": f"https://wa.me/{w.phone_number}?text=", "created_at": w.created_at.isoformat() if w.created_at else None,
    }


async def _owned(db: AsyncSession, ctx: Ctx, widget_id: uuid.UUID) -> Widget:
    w = await db.get(Widget, widget_id)
    if w is None or w.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Widget not found."})
    return w


def _base(request: Request) -> str:
    return public_base(str(request.base_url))


@router.get("")
async def list_widgets(request: Request, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.execute(select(Widget).where(Widget.tenant_id == ctx.tenant_id).order_by(Widget.created_at))).scalars().all()
    return [_out(w, _base(request)) for w in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_widget(body: WidgetIn, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    fallback = ""
    if not re.sub(r"\D", "", body.phone_number):  # no number typed: default to the connected one so the widget works out of the box
        acct = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status == "connected").limit(1))).scalar_one_or_none()
        fallback = re.sub(r"\D", "", acct.display_phone_number or "") if acct else ""
    data = _clean(body, fallback)  # validate only after the fallback is applied — otherwise a blank number always 422s
    w = Widget(tenant_id=ctx.tenant_id, public_key=secrets.token_urlsafe(12).replace("-", "a").replace("_", "b"), **data)
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return _out(w, _base(request))


@router.put("/{widget_id}")
async def update_widget(widget_id: uuid.UUID, body: WidgetIn, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    w = await _owned(db, ctx, widget_id)
    for k, v in _clean(body).items():
        setattr(w, k, v)
    await db.commit()
    await db.refresh(w)
    return _out(w, _base(request))


@router.delete("/{widget_id}", status_code=204, response_model=None)
async def delete_widget(widget_id: uuid.UUID, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> None:
    await db.delete(await _owned(db, ctx, widget_id))
    await db.commit()
