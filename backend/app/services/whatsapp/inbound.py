"""Inbound WhatsApp webhook processing: verify -> dedupe -> persist. Automation runs afterwards (see automation/dispatcher.py)."""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.core.crypto import CryptoError, decrypt
from app.models.broadcast import Broadcast, BroadcastRecipient
from app.models.conversation import Message
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant
from app.models.webhook import WebhookIngress
from app.models.whatsapp_account import WhatsAppAccount
from app.services import assignment, outbound_webhooks
from app.services.whatsapp import messaging
from app.services.whatsapp.graph import GraphError
from app.services.whatsapp.templates import STATUS_MAP

log = logging.getLogger(__name__)

OPT_OUT_WORDS = {"stop", "unsubscribe", "stop all", "opt out", "optout", "cancel subscription"}
OPT_IN_WORDS = {"start", "subscribe", "unstop", "opt in", "optin"}
_STATUS_RANK = {"queued": 0, "sent": 1, "delivered": 2, "read": 3}


@dataclass
class IngestResult:
    dispatch: list[uuid.UUID] = field(default_factory=list)  # inbound message ids that automation should look at
    messages: int = 0
    statuses: int = 0
    duplicates: int = 0
    other: int = 0


def verify_signature(raw_body: bytes, header: str | None, secret: str) -> bool:
    if not header or not secret or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def app_secret_for(account: WhatsAppAccount | None) -> str:
    """Per-account Meta app secret if the tenant runs their own app, otherwise the platform's."""
    if account is not None and account.app_secret_enc:
        try:
            return decrypt(account.app_secret_enc)
        except CryptoError:
            log.error("cannot decrypt app secret for account %s", account.id)
    return get_settings().meta_app_secret


async def _claim(db: AsyncSession, tenant_id: uuid.UUID | None, key: str, payload: dict) -> bool:
    """Insert the event key; False means we've already processed it (Meta retries deliveries)."""
    stmt = (
        pg_insert(WebhookIngress)
        .values(id=uuid.uuid4(), tenant_id=tenant_id, source="whatsapp", event_key=key[:200], payload=payload, processed=True)
        .on_conflict_do_nothing(index_elements=["event_key"])
        .returning(WebhookIngress.id)
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None


def _ts(value: str | int | None) -> datetime:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return datetime.now(timezone.utc)


def parse_message(m: dict) -> tuple[str, str | None, dict]:
    """Return (our type, display body, extras) for an inbound Meta message object."""
    t = m.get("type", "text")
    extras: dict = {}
    if t == "text":
        return "text", m.get("text", {}).get("body", ""), extras
    if t in {"image", "video", "audio", "document", "sticker"}:
        obj = m.get(t, {})
        extras = {"media_id": obj.get("id"), "media_mime": obj.get("mime_type"), "media_filename": obj.get("filename")}
        return t, obj.get("caption"), extras
    if t == "location":
        loc = m.get("location", {})
        extras = {"payload": {"latitude": loc.get("latitude"), "longitude": loc.get("longitude"), "name": loc.get("name"), "address": loc.get("address")}}
        return "location", loc.get("name") or loc.get("address") or "Shared a location", extras
    if t == "interactive":
        inter = m.get("interactive", {})
        reply = inter.get("button_reply") or inter.get("list_reply") or {}
        extras = {"payload": {"reply_id": reply.get("id"), "reply_title": reply.get("title"), "kind": inter.get("type")}}
        return "interactive", reply.get("title"), extras
    if t == "button":  # quick-reply button on a template
        b = m.get("button", {})
        extras = {"payload": {"reply_id": b.get("payload"), "reply_title": b.get("text"), "kind": "template_button"}}
        return "button", b.get("text"), extras
    if t == "reaction":
        r = m.get("reaction", {})
        extras = {"payload": {"emoji": r.get("emoji"), "reacted_to": r.get("message_id")}}
        return "reaction", r.get("emoji"), extras
    if t == "contacts":
        return "text", "Shared a contact", {"payload": {"contacts": m.get("contacts")}}
    return "text", f"[{t} message — not supported yet]", {"payload": {"raw_type": t}}


async def ingest(db: AsyncSession, payload: dict, *, account: WhatsAppAccount | None = None) -> IngestResult:
    """Process a webhook payload. `account` is given for per-account URLs; the shared platform URL resolves it from the payload."""
    result = IngestResult()
    for entry in payload.get("entry", []):
        waba_id = str(entry.get("id", ""))
        for change in entry.get("changes", []):
            field_name, value = change.get("field"), change.get("value") or {}
            try:
                if field_name == "messages":
                    await _handle_messages_change(db, value, account, result)
                elif field_name == "message_template_status_update":
                    await _handle_template_status(db, value, waba_id, account, result)
                elif field_name == "phone_number_quality_update":
                    await _handle_quality(db, value, waba_id, account, result)
                elif field_name in {"account_update", "account_review_update", "template_category_update"}:
                    await _handle_notice(db, field_name, value, waba_id, account, result)
                else:
                    result.other += 1
            except Exception:  # noqa: BLE001 — one bad change must not drop the rest of the batch
                log.exception("webhook change failed field=%s", field_name)
                await db.rollback()
    await db.commit()
    return result


async def _account_for_phone(db: AsyncSession, phone_number_id: str) -> WhatsAppAccount | None:
    return (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.phone_number_id == phone_number_id))).scalar_one_or_none()


async def _account_for_waba(db: AsyncSession, waba_id: str, hint: WhatsAppAccount | None) -> WhatsAppAccount | None:
    if hint is not None:
        return hint if hint.waba_id == waba_id else None
    return (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.waba_id == waba_id).limit(1))).scalar_one_or_none()


async def _handle_messages_change(db: AsyncSession, value: dict, hint: WhatsAppAccount | None, result: IngestResult) -> None:
    phone_number_id = str((value.get("metadata") or {}).get("phone_number_id", ""))
    account = hint or await _account_for_phone(db, phone_number_id)
    if account is None or account.phone_number_id != phone_number_id:
        log.warning("webhook for unknown/mismatched phone_number_id=%s", phone_number_id)
        return
    account.last_webhook_at = datetime.now(timezone.utc)
    if account.status == "error" and (value.get("messages") or value.get("statuses")):
        account.status, account.last_error = "connected", None  # traffic flowing again

    profiles = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts", [])}
    for m in value.get("messages", []):
        await _handle_inbound_message(db, account, m, profiles, result)
    for s in value.get("statuses", []):
        await _handle_status(db, account, s, result)


async def _handle_inbound_message(db: AsyncSession, account: WhatsAppAccount, m: dict, profiles: dict, result: IngestResult) -> None:
    wamid = m.get("id")
    if not wamid or not await _claim(db, account.tenant_id, f"msg:{wamid}", m):
        result.duplicates += 1
        return

    wa_id = re_digits(m.get("from", ""))
    if not wa_id:
        return
    now = datetime.now(timezone.utc)
    sent_at = _ts(m.get("timestamp"))
    mtype, body, extras = parse_message(m)

    contact, contact_created = await messaging.upsert_contact(db, account.tenant_id, wa_id, name=profiles.get(m.get("from")), source="whatsapp")
    conv, conv_created = await messaging.get_or_create_conversation(db, account, contact)

    referral = m.get("referral")
    payload = dict(extras.pop("payload", {}) or {})
    if m.get("context"):
        payload["reply_to"] = m["context"].get("id")
    if referral:
        contact.ad_attribution = {k: referral.get(k) for k in ("source_url", "source_type", "source_id", "headline", "body", "ctwa_clid") if referral.get(k)}
        conv.free_entry_until = now + timedelta(hours=72)
        if contact_created:
            contact.source = "meta_ads"

    lowered = (body or "").strip().lower() if mtype == "text" else ""
    opt_out = lowered in OPT_OUT_WORDS
    opt_in = lowered in OPT_IN_WORDS and contact.opted_out
    if opt_out:
        payload["opt_out"] = True
        if not contact.opted_out:
            contact.opted_out, contact.opted_out_at = True, now
            await outbound_webhooks.emit(account.tenant_id, "contact_opted_out", {"phone": contact.phone, "contact_id": str(contact.id)})
    elif opt_in:
        payload["opt_in"] = True
        contact.opted_out, contact.opted_out_at = False, None

    msg = Message(
        tenant_id=account.tenant_id, conversation_id=conv.id, direction="in", type=mtype, body=body, wamid=wamid, status="received",
        sender_type="contact", payload=payload, created_at=sent_at, sent_at=sent_at, **extras,
    )
    db.add(msg)
    await db.flush()

    if mtype != "reaction":
        conv.last_inbound_at = sent_at
        conv.last_message_at = max(sent_at, conv.last_message_at or sent_at)
        conv.last_message_preview = messaging.preview_for(mtype, body)
        conv.unread_count = (conv.unread_count or 0) + 1
        if conv.status == "resolved":
            conv.status = "open"  # a new message reopens the conversation
    contact.last_contacted_at = now

    if conv_created:
        tenant = await db.get(Tenant, account.tenant_id)
        if tenant is not None:
            await assignment.assign_new(db, tenant, conv)
            flag_modified(tenant, "settings")

    await _attribute_reply_to_broadcast(db, contact.id, now)
    await db.commit()

    result.messages += 1
    if mtype != "reaction":
        result.dispatch.append(msg.id)
    await outbound_webhooks.emit(account.tenant_id, "message_received", {"message_id": str(msg.id), "from": contact.phone, "type": mtype, "text": body})
    if contact_created:
        await outbound_webhooks.emit(account.tenant_id, "contact_created", {"contact_id": str(contact.id), "phone": contact.phone, "source": contact.source})
    if conv_created:
        await outbound_webhooks.emit(account.tenant_id, "conversation_created", {"conversation_id": str(conv.id), "phone": contact.phone})


def re_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


async def _attribute_reply_to_broadcast(db: AsyncSession, contact_id: uuid.UUID, now: datetime) -> None:
    rec = (await db.execute(
        select(BroadcastRecipient)
        .where(BroadcastRecipient.contact_id == contact_id, BroadcastRecipient.replied_at.is_(None),
               BroadcastRecipient.status.in_(("sent", "delivered", "read")), BroadcastRecipient.sent_at > now - timedelta(hours=72))
        .order_by(BroadcastRecipient.sent_at.desc()).limit(1)
    )).scalar_one_or_none()
    if rec is not None:
        rec.replied_at = now
        await recount_broadcast(db, rec.broadcast_id)


async def _handle_status(db: AsyncSession, account: WhatsAppAccount, s: dict, result: IngestResult) -> None:
    wamid, status = s.get("id"), (s.get("status") or "").lower()
    if not wamid or status not in {"sent", "delivered", "read", "failed"}:
        return
    if not await _claim(db, account.tenant_id, f"status:{wamid}:{status}", s):
        result.duplicates += 1
        return
    result.statuses += 1
    ts = _ts(s.get("timestamp"))
    err_text = None
    if status == "failed" and s.get("errors"):
        e = s["errors"][0]
        err_text = f"{e.get('title') or e.get('message') or 'Delivery failed'} (code {e.get('code')})"

    msg = (await db.execute(select(Message).where(Message.tenant_id == account.tenant_id, Message.wamid == wamid))).scalar_one_or_none()
    if msg is not None:
        if status == "failed":
            if msg.status not in {"delivered", "read"}:
                msg.status, msg.error = "failed", err_text
        elif _STATUS_RANK.get(status, 0) > _STATUS_RANK.get(msg.status, 0):
            msg.status = status
        if status == "sent":
            msg.sent_at = msg.sent_at or ts
        elif status == "delivered":
            msg.delivered_at = msg.delivered_at or ts
        elif status == "read":
            msg.delivered_at = msg.delivered_at or ts
            msg.read_at = msg.read_at or ts

    rec = (await db.execute(select(BroadcastRecipient).where(BroadcastRecipient.tenant_id == account.tenant_id, BroadcastRecipient.wamid == wamid))).scalar_one_or_none()
    if rec is not None:
        if status == "failed":
            if rec.status not in {"delivered", "read"}:
                rec.status, rec.error = "failed", err_text
        elif _STATUS_RANK.get(status, 0) > _STATUS_RANK.get(rec.status, 0):
            rec.status = status
        if status in {"delivered", "read"}:
            rec.delivered_at = rec.delivered_at or ts
        if status == "read":
            rec.read_at = rec.read_at or ts
        await db.flush()
        await recount_broadcast(db, rec.broadcast_id)

    await db.commit()
    event = {"sent": "message_sent", "delivered": "message_delivered", "read": "message_read", "failed": "message_failed"}[status]
    if status != "sent":  # 'sent' was already emitted at send time
        await outbound_webhooks.emit(account.tenant_id, event, {"wamid": wamid, "status": status, "recipient": s.get("recipient_id"), "error": err_text})


async def recount_broadcast(db: AsyncSession, broadcast_id: uuid.UUID) -> None:
    """Derive campaign counters from recipient rows — idempotent and immune to duplicate/out-of-order webhooks."""
    r = BroadcastRecipient
    row = (await db.execute(
        select(
            func.count().filter(r.status.in_(("sent", "delivered", "read"))),
            func.count().filter(r.status.in_(("delivered", "read"))),
            func.count().filter(r.status == "read"),
            func.count().filter(r.status == "failed"),
            func.count().filter(r.replied_at.is_not(None)),
        ).where(r.broadcast_id == broadcast_id)
    )).one()
    await db.execute(update(Broadcast).where(Broadcast.id == broadcast_id).values(sent=row[0], delivered=row[1], read=row[2], failed=row[3], replied=row[4]))


async def _handle_template_status(db: AsyncSession, value: dict, waba_id: str, hint: WhatsAppAccount | None, result: IngestResult) -> None:
    account = await _account_for_waba(db, waba_id, hint)
    if account is None:
        return
    name, lang, event = value.get("message_template_name"), value.get("message_template_language"), (value.get("event") or "").upper()
    if not await _claim(db, account.tenant_id, f"tpl:{value.get('message_template_id')}:{event}:{value.get('reason')}", value):
        result.duplicates += 1
        return
    q = select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == account.tenant_id, WhatsAppTemplate.name == name)
    if lang:
        q = q.where(WhatsAppTemplate.language == lang)
    tpl = (await db.execute(q)).scalars().first()
    if tpl is None:
        return
    tpl.status = STATUS_MAP.get(event, tpl.status)
    tpl.meta_template_id = str(value.get("message_template_id") or tpl.meta_template_id or "") or None
    reason = value.get("reason")
    tpl.meta_rejection_reason = reason if event == "REJECTED" and reason not in (None, "NONE") else (None if event == "APPROVED" else tpl.meta_rejection_reason)
    await db.commit()
    result.other += 1
    await outbound_webhooks.emit(account.tenant_id, "template_status_update", {"name": name, "language": lang, "status": tpl.status, "reason": tpl.meta_rejection_reason})


async def _handle_quality(db: AsyncSession, value: dict, waba_id: str, hint: WhatsAppAccount | None, result: IngestResult) -> None:
    account = await _account_for_waba(db, waba_id, hint)
    if account is None:
        return
    account.messaging_limit = value.get("current_limit") or account.messaging_limit
    account.settings = {**(account.settings or {}), "last_quality_event": {"event": value.get("event"), "at": datetime.now(timezone.utc).isoformat()}}
    flag_modified(account, "settings")
    try:
        from app.services.whatsapp.accounts import refresh_account  # local import: accounts -> templates -> ... avoids a cycle
        await refresh_account(db, account)
    except GraphError as exc:
        log.warning("quality refresh failed: %s", exc)
    await db.commit()
    result.other += 1


async def _handle_notice(db: AsyncSession, kind: str, value: dict, waba_id: str, hint: WhatsAppAccount | None, result: IngestResult) -> None:
    account = await _account_for_waba(db, waba_id, hint)
    if account is None:
        return
    notices = list((account.settings or {}).get("notices", []))[-19:]
    notices.append({"kind": kind, "at": datetime.now(timezone.utc).isoformat(), "detail": {k: v for k, v in value.items() if isinstance(v, (str, int, float, bool))}})
    account.settings = {**(account.settings or {}), "notices": notices}
    flag_modified(account, "settings")
    await db.commit()
    result.other += 1
