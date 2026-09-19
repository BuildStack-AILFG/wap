"""Outbound messaging: the one place that talks to Graph for sends and keeps messages/conversations consistent."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt
from app.models.contact import Contact
from app.models.conversation import Conversation, Message
from app.models.whatsapp_account import WhatsAppAccount
from app.services import outbound_webhooks
from app.services.whatsapp.graph import GraphClient, GraphError

log = logging.getLogger(__name__)

WINDOW = timedelta(hours=24)


class SendBlocked(Exception):
    """A send was refused locally (outside 24h window, opted-out) before ever calling Meta."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.message = message
        self.code = code


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def window_open(conv: Conversation, now: datetime | None = None) -> bool:
    now = now or utcnow()
    if conv.last_inbound_at and now - conv.last_inbound_at < WINDOW:
        return True
    return bool(conv.free_entry_until and conv.free_entry_until > now)


def window_expires_at(conv: Conversation) -> datetime | None:
    candidates = []
    if conv.last_inbound_at:
        candidates.append(conv.last_inbound_at + WINDOW)
    if conv.free_entry_until:
        candidates.append(conv.free_entry_until)
    return max(candidates) if candidates else None


def preview_for(msg_type: str, body: str | None) -> str:
    if body:
        return body[:280]
    return {"image": "📷 Photo", "video": "🎥 Video", "audio": "🎵 Audio", "document": "📄 Document", "sticker": "Sticker",
            "location": "📍 Location", "template": "Template message", "interactive": "Interactive message"}.get(msg_type, msg_type.title())


# ---- contacts & conversations ------------------------------------------------------------------------------------

async def upsert_contact(db: AsyncSession, tenant_id: uuid.UUID, phone: str, *, name: str | None = None, source: str = "manual",
                         email: str | None = None) -> tuple[Contact, bool]:
    """Race-safe get-or-create by (tenant, phone). Returns (contact, created)."""
    stmt = (
        pg_insert(Contact)
        .values(id=uuid.uuid4(), tenant_id=tenant_id, phone=phone, name=name or f"+{phone}", email=email, source=source, tags=[], custom_fields={}, ad_attribution={}, opted_out=False)
        .on_conflict_do_nothing(constraint="uq_contacts_tenant_phone")
        .returning(Contact.id)
    )
    inserted = (await db.execute(stmt)).scalar_one_or_none()
    contact = (await db.execute(select(Contact).where(Contact.tenant_id == tenant_id, Contact.phone == phone))).scalar_one()
    if inserted is None and name and (contact.name.startswith("+") or contact.name == contact.phone):
        contact.name = name  # replace a placeholder name with the real WhatsApp profile name
    return contact, inserted is not None


async def get_or_create_conversation(db: AsyncSession, account: WhatsAppAccount, contact: Contact) -> tuple[Conversation, bool]:
    stmt = (
        pg_insert(Conversation)
        .values(id=uuid.uuid4(), tenant_id=account.tenant_id, account_id=account.id, contact_id=contact.id, status="open", inbox_status="bot", labels=[], unread_count=0)
        .on_conflict_do_nothing(constraint="uq_conversations_account_contact")
        .returning(Conversation.id)
    )
    inserted = (await db.execute(stmt)).scalar_one_or_none()
    conv = (await db.execute(select(Conversation).where(Conversation.account_id == account.id, Conversation.contact_id == contact.id))).scalar_one()
    return conv, inserted is not None


def client_for(account: WhatsAppAccount) -> GraphClient:
    return GraphClient(decrypt(account.access_token_enc))


# ---- outbound -----------------------------------------------------------------------------------------------------

async def send_message(
    db: AsyncSession,
    account: WhatsAppAccount,
    conversation: Conversation,
    contact: Contact,
    *,
    kind: str,                      # text|image|video|audio|document|interactive|template
    text: str | None = None,        # text body / media caption
    media_id: str | None = None,
    media_link: str | None = None,
    media_filename: str | None = None,
    media_mime: str | None = None,
    interactive: dict | None = None,
    template_name: str | None = None,
    template_language: str | None = None,
    template_components: list[dict] | None = None,
    template_preview: str | None = None,
    marketing: bool = False,
    sender_type: str = "agent",
    sender_user_id: uuid.UUID | None = None,
    broadcast_id: uuid.UUID | None = None,
    callback_data: str | None = None,
    extra_payload: dict | None = None,
    strict: bool = True,
) -> Message:
    """Send one message and persist it. `strict=True` re-raises Meta errors after recording the failed message."""
    if account.status == "disconnected":
        raise SendBlocked("This WhatsApp number is disconnected.", "account_disconnected")
    if contact.opted_out and (marketing or sender_type in {"broadcast", "flow"}):
        raise SendBlocked("This contact has opted out of messages.", "opted_out")
    if kind != "template" and not window_open(conversation):
        raise SendBlocked(
            "The 24-hour customer service window has closed — send an approved template message instead.", "outside_window",
        )

    body = text
    if kind == "template":
        body = template_preview or template_name
    msg = Message(
        tenant_id=account.tenant_id, conversation_id=conversation.id, direction="out", type=kind, body=body, status="queued",
        media_id=media_id, media_mime=media_mime, media_filename=media_filename,
        payload={**{k: v for k, v in {"template": template_name, "language": template_language, "components": template_components,
                                      "interactive": interactive, "link": media_link}.items() if v}, **(extra_payload or {})},
        sender_type=sender_type, sender_user_id=sender_user_id, broadcast_id=broadcast_id, callback_data=callback_data,
    )
    db.add(msg)
    await db.flush()

    client = client_for(account)
    error: GraphError | None = None
    try:
        if kind == "text":
            wamid = await client.send_text(account.phone_number_id, contact.phone, text or "")
        elif kind in {"image", "video", "audio", "document"}:
            wamid = await client.send_media(account.phone_number_id, contact.phone, kind, link=media_link, media_id=media_id, caption=text, filename=media_filename)
        elif kind == "interactive":
            wamid = await client.send_interactive(account.phone_number_id, contact.phone, interactive or {})
        elif kind == "template":
            wamid = await client.send_template(account.phone_number_id, contact.phone, template_name or "", template_language or "en", template_components)
        else:
            raise ValueError(f"Unsupported message kind: {kind}")
        msg.wamid, msg.status, msg.sent_at = wamid, "sent", utcnow()
    except GraphError as exc:
        error = exc
        msg.status, msg.error = "failed", str(exc)[:1000]
        if exc.is_auth_error:
            account.status, account.last_error = "error", str(exc)[:500]
        log.warning("send failed tenant=%s to=%s code=%s: %s", account.tenant_id, contact.phone, exc.code, exc)

    now = utcnow()
    conversation.last_message_at = now
    conversation.last_message_preview = preview_for(kind, body)
    contact.last_contacted_at = now
    await db.commit()

    if error is None:
        await outbound_webhooks.emit(account.tenant_id, "message_sent", {"message_id": str(msg.id), "wamid": msg.wamid, "to": contact.phone, "type": kind})
    elif strict:
        raise error
    return msg


def buttons_interactive(body: str, buttons: list[dict], header: str | None = None, footer: str | None = None) -> dict:
    """Reply-button message (max 3 buttons, titles <= 20 chars)."""
    out: dict[str, Any] = {
        "type": "button", "body": {"text": body},
        "action": {"buttons": [{"type": "reply", "reply": {"id": str(b["id"])[:256], "title": str(b["title"])[:20]}} for b in buttons[:3]]},
    }
    if header:
        out["header"] = {"type": "text", "text": header[:60]}
    if footer:
        out["footer"] = {"text": footer[:60]}
    return out


def list_interactive(body: str, button_text: str, sections: list[dict], header: str | None = None, footer: str | None = None) -> dict:
    """List message (max 10 rows total). sections: [{title, rows:[{id, title, description?}]}]"""
    out: dict[str, Any] = {
        "type": "list", "body": {"text": body},
        "action": {"button": button_text[:20], "sections": [
            {"title": s.get("title", "")[:24], "rows": [
                {k: v for k, v in {"id": str(r["id"])[:200], "title": str(r["title"])[:24], "description": (r.get("description") or "")[:72] or None}.items() if v}
                for r in s.get("rows", [])
            ]} for s in sections
        ]},
    }
    if header:
        out["header"] = {"type": "text", "text": header[:60]}
    if footer:
        out["footer"] = {"text": footer[:60]}
    return out
