"""Behavioural events (from the API, integrations or the dashboard): record them, then let matching flows and actions react."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_flow import AutomationFlow
from app.models.contact import Contact
from app.models.contact_event import ContactEvent
from app.models.template import WhatsAppTemplate
from app.models.whatsapp_account import WhatsAppAccount
from app.services import templating
from app.services.automation import flow_engine
from app.services.whatsapp import messaging
from app.services.whatsapp.templates import TemplateValidationError, build_send_components, render_preview

log = logging.getLogger(__name__)


async def record_event(db: AsyncSession, tenant_id: uuid.UUID, contact: Contact, name: str, properties: dict, source: str) -> ContactEvent:
    ev = ContactEvent(tenant_id=tenant_id, contact_id=contact.id, name=name[:100], properties=properties or {}, source=source)
    db.add(ev)
    await db.flush()
    return ev


async def trigger_flows(db: AsyncSession, tenant_id: uuid.UUID, contact: Contact, name: str, properties: dict) -> int:
    """Start published flows whose Start node listens for this event name."""
    flows = (await db.execute(select(AutomationFlow).where(AutomationFlow.tenant_id == tenant_id, AutomationFlow.status == "published", AutomationFlow.trigger_type == "event"))).scalars().all()
    started = 0
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == tenant_id, WhatsAppAccount.status == "connected").limit(1))).scalar_one_or_none()
    for f in flows:
        start = next((n for n in (f.published_snapshot or {}).get("nodes", []) if n.get("type") == "start"), None)
        if ((start or {}).get("data") or {}).get("event") != name:
            continue
        conv = (await messaging.get_or_create_conversation(db, account, contact))[0] if account else None
        if await flow_engine.start_flow(db, f, contact, conv, context={k: v for k, v in (properties or {}).items() if isinstance(v, (str, int, float, bool))}) is not None:
            started += 1
    return started


async def run_action(db: AsyncSession, tenant_id: uuid.UUID, contact: Contact, action: dict, properties: dict) -> dict:
    """Integration action: {type:'send_template', template_id, body:[..], header_text?, header_media?, buttons?} — values may use {{name}} / {{var.order_id}}."""
    if action.get("type") != "send_template" or not action.get("template_id"):
        return {"ok": False, "error": "Unsupported action."}
    tpl = await db.get(WhatsAppTemplate, uuid.UUID(str(action["template_id"])))
    if tpl is None or tpl.tenant_id != tenant_id or tpl.status != "approved":
        return {"ok": False, "error": "Template missing or not approved."}
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == tenant_id, WhatsAppAccount.status == "connected").limit(1))).scalar_one_or_none()
    if account is None:
        return {"ok": False, "error": "No connected WhatsApp number."}
    r = lambda s: templating.render(str(s), contact, properties, fallback="-")  # noqa: E731
    try:
        body_vals = [r(v) for v in action.get("body", [])]
        comps = build_send_components(tpl, body=body_vals, header_text=r(action["header_text"]) if action.get("header_text") else None, header_media=action.get("header_media"),
                                      buttons={k: r(v) for k, v in (action.get("buttons") or {}).items()})
    except TemplateValidationError as exc:
        return {"ok": False, "error": str(exc)}
    conv, _ = await messaging.get_or_create_conversation(db, account, contact)
    try:
        msg = await messaging.send_message(db, account, conv, contact, kind="template", template_name=tpl.name, template_language=tpl.language, template_components=comps,
                                           template_preview=render_preview(tpl, body_vals), marketing=tpl.category == "MARKETING", sender_type="api", strict=False)
    except messaging.SendBlocked as exc:
        return {"ok": False, "error": exc.message}
    return {"ok": msg.status != "failed", "message_id": str(msg.id), "error": msg.error}


async def process(db: AsyncSession, tenant_id: uuid.UUID, contact: Contact, name: str, properties: dict, source: str, action: dict | None = None) -> dict[str, Any]:
    await record_event(db, tenant_id, contact, name, properties, source)
    flows = await trigger_flows(db, tenant_id, contact, name, properties)
    result: dict[str, Any] = {"event": name, "flows_started": flows}
    if action:
        result["action"] = await run_action(db, tenant_id, contact, action, properties)
    await db.commit()
    return result
