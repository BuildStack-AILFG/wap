"""Unauthenticated endpoints used by visitors' browsers: the widget script, its tracking beacons, lead capture, QR codes."""

from __future__ import annotations

import io
import json
import logging
from urllib.parse import urlsplit

import segno
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core import ratelimit
from app.models.contact import Contact
from app.models.contact_event import ContactEvent
from app.models.widget import Widget
from app.services import outbound_webhooks, quotas, widget_js
from app.services.phone import InvalidPhone, normalize_phone
from app.services.whatsapp import messaging
from app.services.whatsapp.accounts import public_base

log = logging.getLogger(__name__)
router = APIRouter(prefix="/public", tags=["public"])

CACHE_HEADERS = {"Cache-Control": "public, max-age=120", "Access-Control-Allow-Origin": "*"}


async def _widget(db: AsyncSession, key: str) -> Widget | None:
    return (await db.execute(select(Widget).where(Widget.public_key == key))).scalar_one_or_none()


def _host_allowed(w: Widget, request: Request) -> bool:
    """Soft domain lock. Browsers send Referer for <script> loads and Origin/Referer on beacons; absent = allow (can't be enforced)."""
    if not w.allowed_domains:
        return True
    src = request.headers.get("origin") or request.headers.get("referer")
    if not src:
        return True
    host = (urlsplit(src).hostname or "").lower()
    return any(host == d or (d.startswith("*.") and host.endswith(d[1:])) or host.endswith("." + d) for d in w.allowed_domains)


@router.get("/widget/{key}.js")
async def widget_script(key: str, request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    w = await _widget(db, key)
    if w is None or not w.enabled or not w.phone_number or not _host_allowed(w, request):
        return Response(widget_js.NOOP, media_type="application/javascript", headers=CACHE_HEADERS)
    config = {
        "key": w.public_key, "api": f"{public_base(str(request.base_url))}/api/public/widget/{w.public_key}", "phone": w.phone_number, "title": w.title,
        "subtitle": w.subtitle, "welcome": w.welcome_message, "prefill": w.prefill_message, "cta": w.cta_text, "color": w.brand_color, "position": w.position,
        "bottom": w.bottom_offset, "delay": w.delay_seconds, "lead": w.collect_lead,
    }
    return Response(widget_js.build(config), media_type="application/javascript", headers=CACHE_HEADERS)


async def _body(request: Request) -> dict:
    """Beacons post text/plain (no CORS preflight). Parse leniently — this endpoint is public."""
    raw = await request.body()
    if len(raw) > 4096:
        raise HTTPException(status_code=413, detail={"error": "Payload too large."})
    try:
        data = json.loads(raw or b"{}")
        return data if isinstance(data, dict) else {}
    except ValueError:
        return {}


@router.post("/widget/{key}/{action}")
async def widget_beacon(key: str, action: str, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    if action not in {"open", "click", "lead"}:
        raise HTTPException(status_code=404, detail={"error": "Not found."})
    ratelimit.limit(request, f"widget-{action}", 30 if action != "lead" else 8, 60, key)
    w = await _widget(db, key)
    if w is None or not w.enabled or not _host_allowed(w, request):
        raise HTTPException(status_code=404, detail={"error": "Not found."})

    if action in {"open", "click"}:
        col = Widget.opens if action == "open" else Widget.clicks
        await db.execute(update(Widget).where(Widget.id == w.id).values({col.key: col + 1}))
        await db.commit()
        return {"ok": True}

    data = await _body(request)
    try:
        phone = normalize_phone(str(data.get("phone", "")))
    except InvalidPhone:
        raise HTTPException(status_code=422, detail={"error": "Invalid phone number."})
    name = str(data.get("name", "")).strip()[:120] or None
    total_ok = True
    try:
        total = (await db.execute(select(func.count()).select_from(Contact).where(Contact.tenant_id == w.tenant_id))).scalar_one()
        await quotas.enforce(db, w.tenant_id, "max_contacts", total, label="contacts")
    except HTTPException:
        total_ok = False
    if not total_ok:  # over the workspace's contact quota: don't error the visitor, just don't store
        return {"ok": True, "stored": False}
    contact, created = await messaging.upsert_contact(db, w.tenant_id, phone, name=name, source="widget")
    if "website-widget" not in (contact.tags or []):
        contact.tags = [*(contact.tags or []), "website-widget"]
    page = str(data.get("page", ""))[:500]
    db.add(ContactEvent(tenant_id=w.tenant_id, contact_id=contact.id, name="widget_lead", properties={"page": page, "widget": w.name}, source="widget"))
    await db.execute(update(Widget).where(Widget.id == w.id).values(leads=Widget.leads + 1))
    await db.commit()
    await outbound_webhooks.emit(w.tenant_id, "lead_captured", {"phone": phone, "name": name, "page": page, "contact_id": str(contact.id), "new_contact": created})
    return {"ok": True, "stored": True}


@router.get("/qr")
async def qr(text: str = Query(min_length=4, max_length=500), scale: int = Query(8, ge=2, le=20), dark: str = Query("#000000", pattern="^#[0-9a-fA-F]{6}$")) -> Response:
    """QR code (SVG) for a click-to-chat link or any http(s) URL."""
    if not text.startswith(("https://", "http://")):
        raise HTTPException(status_code=422, detail={"error": "QR text must be an http(s) URL."})
    buf = io.BytesIO()
    segno.make(text, error="m").save(buf, kind="svg", scale=scale, border=2, dark=dark, xmldecl=False, svgns=True)
    return Response(buf.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/health", response_class=PlainTextResponse)
async def health() -> str:
    return "ok"
