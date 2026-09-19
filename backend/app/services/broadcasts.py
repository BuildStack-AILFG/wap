"""
Broadcast campaigns: snapshot the audience into recipient rows, then send them with pacing, opt-out/quality safeguards and
resumability (state lives in the DB, so a restart just continues). See lib/PHASES.md Phase 4 — a plain loop, no queue yet.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db import session as db_session
from app.models.broadcast import Broadcast, BroadcastRecipient
from app.models.contact import Contact
from app.models.segment import Segment
from app.models.template import WhatsAppTemplate
from app.models.whatsapp_account import WhatsAppAccount
from app.services import outbound_webhooks, segments, templating
from app.services.phone import InvalidPhone, normalize_phone
from app.services.whatsapp import messaging
from app.services.whatsapp.graph import GraphError
from app.services.whatsapp.inbound import recount_broadcast
from app.services.whatsapp.templates import TemplateValidationError, build_send_components, render_preview, required_variables

log = logging.getLogger(__name__)

RATE_LIMIT_PAUSE = timedelta(minutes=10)
MAX_CONSECUTIVE_FAILURES = 8
BATCH = 25
_running: set[uuid.UUID] = set()
_tasks: set[asyncio.Task] = set()


class BroadcastError(ValueError):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---- audience -------------------------------------------------------------------------------------------------------

async def resolve_audience(db: AsyncSession, tenant_id: uuid.UUID, audience: dict, default_cc: str = "") -> tuple[list[tuple[Contact, dict]], int]:
    """Return ([(contact, csv_row)], skipped_opted_out). CSV/number audiences are upserted as contacts first."""
    kind = audience.get("type")
    rows: list[tuple[Contact, dict]] = []
    skipped = 0

    if kind in {"all_contacts", "tag", "segment"}:
        if kind == "all_contacts":
            cond = Contact.tenant_id == tenant_id
        elif kind == "tag":
            if not audience.get("tag"):
                raise BroadcastError("Choose a tag for this audience.")
            cond = (Contact.tenant_id == tenant_id) & Contact.tags.any(audience["tag"])
        else:
            seg = await db.get(Segment, uuid.UUID(str(audience.get("segment_id")))) if audience.get("segment_id") else None
            if seg is None or seg.tenant_id != tenant_id:
                raise BroadcastError("Segment not found.")
            try:
                cond = segments.build_filter(tenant_id, seg.filters)
            except segments.SegmentError as exc:
                raise BroadcastError(str(exc)) from exc
        for c in (await db.execute(select(Contact).where(cond))).scalars():
            if c.opted_out:
                skipped += 1
            else:
                rows.append((c, {}))
    elif kind in {"csv", "numbers"}:
        seen: set[str] = set()
        for entry in audience.get("rows", []):
            try:
                phone = normalize_phone(str(entry.get("phone", "")), default_cc)
            except InvalidPhone:
                skipped += 1
                continue
            if phone in seen:
                continue
            seen.add(phone)
            contact, _ = await messaging.upsert_contact(db, tenant_id, phone, name=entry.get("name") or None, source="import")
            if contact.opted_out:
                skipped += 1
                continue
            rows.append((contact, {k: v for k, v in entry.items() if k not in {"phone"}}))
    else:
        raise BroadcastError("Unknown audience type.")
    return rows, skipped


def _pick(spec: Any, contact: Contact, row: dict, fallback: str) -> str:
    if not isinstance(spec, dict):
        return str(spec) if spec not in (None, "") else fallback
    source, value = spec.get("source", "fixed"), spec.get("value")
    if source == "fixed":
        return str(value) if value not in (None, "") else fallback
    if source.startswith("csv:"):
        v = row.get(source[4:])
        return str(v) if v not in (None, "") else fallback
    return templating.resolve_field(contact, source) or fallback


def resolve_variables(tpl: WhatsAppTemplate, mapping: dict, contact: Contact, row: dict) -> dict:
    need = required_variables(tpl)
    fb = str(mapping.get("fallback") or "there")
    out: dict[str, Any] = {"body": [_pick((mapping.get("body") or {}).get(str(n)), contact, row, fb) for n in need["body"]]}
    if need["header_text"]:
        out["header_text"] = _pick(mapping.get("header_text"), contact, row, fb)
    if need["header_media"]:
        media = mapping.get("header_media")
        if not media:
            raise BroadcastError(f"This template needs a {need['header_media']} URL for its header.")
        out["header_media"] = media
    if need["buttons"]:
        out["buttons"] = {str(i): _pick((mapping.get("buttons") or {}).get(str(i)), contact, row, "") for i in need["buttons"]}
    return out


# ---- creation ---------------------------------------------------------------------------------------------------------

async def create_recipients(db: AsyncSession, broadcast: Broadcast, tpl: WhatsAppTemplate, default_cc: str = "") -> int:
    audience, skipped = await resolve_audience(db, broadcast.tenant_id, broadcast.audience, default_cc)
    if not audience:
        raise BroadcastError("This audience has no contacts who can receive messages" + (f" ({skipped} skipped: opted out or invalid)." if skipped else "."))
    try:
        for contact, row in audience:
            variables = resolve_variables(tpl, broadcast.variable_mapping or {}, contact, row)
            build_send_components(tpl, **{k: variables.get(k) for k in ("body", "header_text", "header_media", "buttons")})  # fail fast on bad mapping
            db.add(BroadcastRecipient(tenant_id=broadcast.tenant_id, broadcast_id=broadcast.id, contact_id=contact.id, phone=contact.phone, variables=variables, status="pending"))
    except TemplateValidationError as exc:
        raise BroadcastError(str(exc)) from exc
    broadcast.total_recipients = len(audience)
    return skipped


async def monthly_recipient_count(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    start = utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return (await db.execute(select(func.coalesce(func.sum(Broadcast.total_recipients), 0)).where(
        Broadcast.tenant_id == tenant_id, Broadcast.created_at >= start, Broadcast.status.notin_(("cancelled", "draft"))))).scalar_one()


# ---- sending ------------------------------------------------------------------------------------------------------------

def start_in_background(broadcast_id: uuid.UUID) -> None:
    """Kick off sending without blocking the request. Safe to call twice — a run is claimed per broadcast."""
    task = asyncio.create_task(run_broadcast(broadcast_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def drain() -> None:
    if _tasks:
        await asyncio.gather(*list(_tasks), return_exceptions=True)


async def _claim(db: AsyncSession, broadcast_id: uuid.UUID) -> bool:
    """Atomically move draft/scheduled(due)/sending -> sending so exactly one worker owns the run."""
    res = await db.execute(
        update(Broadcast).where(Broadcast.id == broadcast_id, Broadcast.status.in_(("draft", "scheduled", "sending")))
        .values(status="sending", started_at=func.coalesce(Broadcast.started_at, func.now()), error=None).returning(Broadcast.id)
    )
    claimed = res.scalar_one_or_none() is not None
    await db.commit()
    return claimed


async def run_broadcast(broadcast_id: uuid.UUID) -> None:
    if broadcast_id in _running:
        return
    _running.add(broadcast_id)
    try:
        async with db_session.async_session_factory() as db:
            if not await _claim(db, broadcast_id):
                return
            await _send_loop(db, broadcast_id)
    except Exception:  # noqa: BLE001
        log.exception("broadcast %s crashed", broadcast_id)
        async with db_session.async_session_factory() as db:
            await db.execute(update(Broadcast).where(Broadcast.id == broadcast_id, Broadcast.status == "sending").values(status="failed", error="Unexpected error while sending."))
            await db.commit()
    finally:
        _running.discard(broadcast_id)


async def _send_loop(db: AsyncSession, broadcast_id: uuid.UUID) -> None:
    b = await db.get(Broadcast, broadcast_id)
    tpl = await db.get(WhatsAppTemplate, b.template_id)
    account = await db.get(WhatsAppAccount, b.account_id) if b.account_id else None
    if tpl is None or tpl.status != "approved" or account is None or account.status != "connected":
        await _finish(db, b, "failed", "Template is not approved or the WhatsApp number is not connected.")
        return
    if account.quality_rating == "RED":
        await _pause(db, b, "Your number's quality rating is RED — sending paused to protect it. It will retry automatically.")
        return

    delay = get_settings().broadcast_send_delay_ms / 1000
    consecutive_failures = 0
    while True:
        await db.refresh(b)
        if b.status != "sending":  # cancelled (or otherwise changed) while running
            return
        batch = list((await db.execute(
            select(BroadcastRecipient).where(BroadcastRecipient.broadcast_id == b.id, BroadcastRecipient.status == "pending")
            .order_by(BroadcastRecipient.created_at).limit(BATCH).with_for_update(skip_locked=True)
        )).scalars())
        if not batch:
            break
        for rec in batch:
            outcome = await _send_one(db, b, tpl, account, rec)
            await db.commit()  # persist the recipient's outcome immediately — a crash must never cause a re-send
            if outcome == "rate_limited":
                await _pause(db, b, "WhatsApp rate limit reached — sending will resume automatically in a few minutes.")
                return
            if outcome == "auth":
                await _finish(db, b, "failed", "WhatsApp rejected the access token. Reconnect your number and retry.")
                return
            consecutive_failures = consecutive_failures + 1 if outcome == "failed" else 0
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                await _finish(db, b, "failed", f"Stopped after {MAX_CONSECUTIVE_FAILURES} consecutive failures — check the last error on a failed recipient.")
                return
            await asyncio.sleep(delay)
        await recount_broadcast(db, b.id)
        await db.commit()

    await recount_broadcast(db, b.id)
    await db.refresh(b)
    await _finish(db, b, "completed", None)


async def _send_one(db: AsyncSession, b: Broadcast, tpl: WhatsAppTemplate, account: WhatsAppAccount, rec: BroadcastRecipient) -> str:
    """Returns sent | skipped | failed | rate_limited | auth."""
    contact = await db.get(Contact, rec.contact_id) if rec.contact_id else None
    if contact is None:
        rec.status, rec.error = "skipped", "Contact no longer exists."
        return "skipped"
    if contact.opted_out:  # they may have opted out after the audience was snapshotted
        rec.status, rec.error = "skipped", "Contact opted out."
        return "skipped"
    try:
        v = rec.variables or {}
        comps = build_send_components(tpl, body=v.get("body"), header_text=v.get("header_text"), header_media=v.get("header_media"), buttons=v.get("buttons"))
        conv, _ = await messaging.get_or_create_conversation(db, account, contact)
        msg = await messaging.send_message(
            db, account, conv, contact, kind="template", template_name=tpl.name, template_language=tpl.language, template_components=comps,
            template_preview=render_preview(tpl, v.get("body")), marketing=tpl.category == "MARKETING", sender_type="broadcast", broadcast_id=b.id, strict=True,
        )
        rec.status, rec.wamid, rec.sent_at, rec.error = "sent", msg.wamid, utcnow(), None
        return "sent"
    except messaging.SendBlocked as exc:
        rec.status, rec.error = "skipped", exc.message
        return "skipped"
    except TemplateValidationError as exc:
        rec.status, rec.error = "failed", str(exc)
        return "failed"
    except GraphError as exc:
        if exc.is_auth_error:
            return "auth"
        if exc.is_rate_limited:
            return "rate_limited"  # recipient stays pending; the loop is paused and resumed later
        rec.status, rec.error = "failed", str(exc)[:500]
        return "failed"


async def _pause(db: AsyncSession, b: Broadcast, reason: str) -> None:
    b.status, b.scheduled_at, b.error = "scheduled", utcnow() + RATE_LIMIT_PAUSE, reason
    await db.commit()


async def _finish(db: AsyncSession, b: Broadcast, status: str, error: str | None) -> None:
    b.status, b.error, b.completed_at = status, error, utcnow()
    await db.commit()
    await outbound_webhooks.emit(b.tenant_id, "broadcast_completed", {"broadcast_id": str(b.id), "name": b.name, "status": status, "sent": b.sent, "delivered": b.delivered, "failed": b.failed})


async def due_broadcasts(db: AsyncSession) -> list[uuid.UUID]:
    """Scheduled campaigns whose time has come, plus 'sending' ones orphaned by a restart."""
    rows = await db.execute(select(Broadcast.id).where(
        ((Broadcast.status == "scheduled") & (Broadcast.scheduled_at <= utcnow())) | (Broadcast.status == "sending")))
    return [r[0] for r in rows if r[0] not in _running]


async def retry_failed(db: AsyncSession, broadcast: Broadcast) -> int:
    res = await db.execute(update(BroadcastRecipient).where(BroadcastRecipient.broadcast_id == broadcast.id, BroadcastRecipient.status == "failed")
                           .values(status="pending", error=None).returning(BroadcastRecipient.id))
    n = len(res.all())
    if n:
        broadcast.status, broadcast.completed_at = "sending", None
    await db.commit()
    return n
