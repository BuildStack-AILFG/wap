"""
Follow-up sequences: nudge a lead over hours or days until they reply, then stop.

Each step waits `delay_minutes` after the previous one and sends one of:
  template  an approved WhatsApp template (works any time)
  text      a plain message (only inside WhatsApp's 24-hour window)
  ai        a short, freshly written nudge from the conversation so far (only inside the 24-hour window)
Outside the window a text/ai step sends its `fallback_template_id` instead, or is skipped and logged. Any inbound message from
the contact marks their active enrollments `replied`; opting out marks them `stopped`. The scheduler (app/services/scheduler.py,
leader-elected) calls `run_due()` every tick.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.followup import FollowupEnrollment, FollowupSequence
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant
from app.models.whatsapp_account import WhatsAppAccount
from app.services import templating
from app.services.ai import agent as ai_agent
from app.services.whatsapp import messaging
from app.services.whatsapp.templates import TemplateValidationError, build_send_components, render_preview

log = logging.getLogger(__name__)

STEP_KINDS = {"template", "text", "ai"}
TRIGGERS = {"manual", "tag", "new_lead"}
MAX_STEPS = 10
MAX_DELAY_MINUTES = 60 * 24 * 30
BATCH = 100
HOURS_RETRY = timedelta(minutes=30)
LOG_KEEP = 30


class FollowupError(ValueError):
    """A sequence definition that can't run."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def validate_steps(steps: list[dict]) -> list[dict]:
    """Normalise and check step definitions; raises FollowupError with a message fit for the UI."""
    if not steps:
        raise FollowupError("Add at least one step.")
    if len(steps) > MAX_STEPS:
        raise FollowupError(f"A sequence can have at most {MAX_STEPS} steps.")
    out = []
    for i, s in enumerate(steps, start=1):
        kind = s.get("kind")
        if kind not in STEP_KINDS:
            raise FollowupError(f"Step {i}: choose a template, a message or an AI follow-up.")
        delay = int(s.get("delay_minutes") or 0)
        if not 0 <= delay <= MAX_DELAY_MINUTES:
            raise FollowupError(f"Step {i}: the wait must be between 0 minutes and 30 days.")
        if kind == "template" and not s.get("template_id"):
            raise FollowupError(f"Step {i}: choose an approved template.")
        if kind == "text" and not (s.get("text") or "").strip():
            raise FollowupError(f"Step {i}: write the message.")
        out.append({
            "kind": kind, "delay_minutes": delay,
            "template_id": str(s["template_id"]) if s.get("template_id") else None,
            "variables": s.get("variables") or {},
            "text": (s.get("text") or "").strip()[:1000],
            "instructions": (s.get("instructions") or "").strip()[:500],
            "fallback_template_id": str(s["fallback_template_id"]) if s.get("fallback_template_id") else None,
        })
    return out


def _note(e: FollowupEnrollment, step: int, event: str, detail: str = "") -> None:
    e.log = [*(e.log or []), {"at": utcnow().isoformat(), "step": step, "event": event, **({"detail": detail[:200]} if detail else {})}][-LOG_KEEP:]
    flag_modified(e, "log")


# ---- enrolling --------------------------------------------------------------------------------------------------------------

async def enroll(db: AsyncSession, seq: FollowupSequence, contact: Contact, *, source: str = "manual") -> FollowupEnrollment | None:
    """Start `contact` on `seq`. Returns None if they're already active in it, opted out, or the sequence is empty/paused.
    Doesn't commit."""
    if not seq.active or not seq.steps or contact.opted_out or contact.tenant_id != seq.tenant_id:
        return None
    eid = uuid.uuid4()
    stmt = (pg_insert(FollowupEnrollment)
            .values(id=eid, tenant_id=seq.tenant_id, sequence_id=seq.id, contact_id=contact.id, status="active", step_index=0, sent_count=0,
                    next_run_at=utcnow() + timedelta(minutes=int(seq.steps[0].get("delay_minutes") or 0)), source=source, log=[])
            .on_conflict_do_nothing(index_elements=["sequence_id", "contact_id"], index_where=FollowupEnrollment.status == "active")
            .returning(FollowupEnrollment.id))
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        return None
    return await db.get(FollowupEnrollment, eid)


async def on_tags_added(db: AsyncSession, contact: Contact, added: set[str]) -> int:
    """Enroll the contact in every active `tag` sequence whose tag was just added. Doesn't commit."""
    added_l = {t.lower() for t in added if t}
    if not added_l:
        return 0
    seqs = (await db.execute(select(FollowupSequence).where(
        FollowupSequence.tenant_id == contact.tenant_id, FollowupSequence.active.is_(True), FollowupSequence.trigger == "tag"))).scalars().all()
    n = 0
    for s in seqs:
        if (s.trigger_value or "").lower() in added_l and await enroll(db, s, contact, source="tag"):
            n += 1
    return n


async def on_new_lead(db: AsyncSession, contact: Contact, lead_source: str) -> int:
    """Enroll a newly captured lead (integration / import) in active `new_lead` sequences for that source ("" = any). Doesn't commit."""
    seqs = (await db.execute(select(FollowupSequence).where(
        FollowupSequence.tenant_id == contact.tenant_id, FollowupSequence.active.is_(True), FollowupSequence.trigger == "new_lead"))).scalars().all()
    n = 0
    for s in seqs:
        if (s.trigger_value or "") in ("", lead_source) and await enroll(db, s, contact, source="new_lead"):
            n += 1
    return n


async def on_inbound(db: AsyncSession, contact: Contact, *, opted_out: bool = False) -> int:
    """The contact wrote back (or opted out): end every active follow-up for them. Doesn't commit."""
    res = await db.execute(update(FollowupEnrollment)
                           .where(FollowupEnrollment.contact_id == contact.id, FollowupEnrollment.status == "active")
                           .values(status="stopped" if opted_out else "replied", finished_at=utcnow(), next_run_at=None))
    return res.rowcount or 0


# ---- running ----------------------------------------------------------------------------------------------------------------

async def _channel(db: AsyncSession, tenant_id: uuid.UUID, contact: Contact) -> tuple[WhatsAppAccount, Conversation] | None:
    """The number the contact last talked to, else the workspace's connected number."""
    conv = (await db.execute(select(Conversation).join(WhatsAppAccount, WhatsAppAccount.id == Conversation.account_id).where(
        Conversation.contact_id == contact.id, WhatsAppAccount.status != "disconnected")
        .order_by(Conversation.last_message_at.desc().nulls_last()).limit(1))).scalar_one_or_none()
    if conv is not None:
        return await db.get(WhatsAppAccount, conv.account_id), conv
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == tenant_id, WhatsAppAccount.status == "connected").limit(1))).scalar_one_or_none()
    if account is None:
        return None
    conv, _ = await messaging.get_or_create_conversation(db, account, contact)
    return account, conv


async def _send_template(db, tenant: Tenant, account, conv, contact, template_id: str | None, variables: dict) -> tuple[bool, str]:
    tpl = await db.get(WhatsAppTemplate, uuid.UUID(template_id)) if template_id else None
    if tpl is None or tpl.tenant_id != tenant.id or tpl.status != "approved":
        return False, "Template is missing or not approved."
    r = lambda s: templating.render(s, contact, {}, business=_business(tenant))  # noqa: E731
    v = variables or {}
    try:
        body_vals = [r(x) for x in v.get("body", [])]
        comps = build_send_components(tpl, body=body_vals, header_text=r(v.get("header_text")) or None, header_media=v.get("header_media"),
                                      buttons={k: r(x) for k, x in (v.get("buttons") or {}).items()})
    except TemplateValidationError as exc:
        return False, str(exc)
    m = await messaging.send_message(db, account, conv, contact, kind="template", template_name=tpl.name, template_language=tpl.language,
                                     template_components=comps, template_preview=render_preview(tpl, body_vals), marketing=tpl.category == "MARKETING",
                                     sender_type="flow", extra_payload={"auto": "followup"}, strict=False)
    return m.status != "failed", (m.error or tpl.name)


def _business(tenant: Tenant) -> str:
    return str(((tenant.settings or {}).get("ai") or {}).get("business_name") or tenant.name)


async def ai_nudge(db: AsyncSession, tenant: Tenant, conv: Conversation, contact: Contact, instructions: str, attempt: int) -> str:
    """A short follow-up written from the conversation so far. Raises ai_agent.AIUnavailable when AI can't be used."""
    conn = ai_agent.connection(tenant)
    await ai_agent._meter(db, tenant, conn.own)  # noqa: SLF001 — same metering as the AI agent's replies
    cfg = ai_agent.get_config(tenant)
    history = await ai_agent._history(db, conv)  # noqa: SLF001
    system = (
        f"You write WhatsApp follow-ups for {cfg['business_name']}. The customer hasn't replied to the last message. "
        f"Write follow-up #{attempt}: one short, friendly message (under 300 characters) that gives them an easy reason to reply. "
        "Refer to what they actually asked about. Don't repeat earlier wording, don't pressure, don't invent prices, offers or deadlines. "
        f"Tone: {cfg['tone']}. Language: {cfg['language']}. Plain text only, no quotes around it.\n"
        f"Customer name: {contact.name}\n{ai_agent._known(contact)}"  # noqa: SLF001
        + (f"Business instructions for this follow-up: {instructions}\n" if instructions else "")
    )
    messages = history or [{"role": "user", "content": "(no earlier messages)"}]
    if messages[-1]["role"] != "user":
        messages = [*messages, {"role": "user", "content": "(no reply yet — write the follow-up)"}]
    text = (await ai_agent.complete(conn.key, system=system, messages=messages, model=conn.model, max_tokens=250, provider=conn.provider)).strip().strip('"')
    if not text:
        raise ai_agent.AIUnavailable("The AI returned an empty follow-up.")
    return text[:1000]


async def run_step(db: AsyncSession, e: FollowupEnrollment) -> str:
    """Send the enrollment's current step and schedule the next. Returns what happened (for logs/tests). Commits."""
    seq = await db.get(FollowupSequence, e.sequence_id)
    contact = await db.get(Contact, e.contact_id)
    tenant = await db.get(Tenant, e.tenant_id)
    now = utcnow()
    if seq is None or contact is None or tenant is None or not seq.active:
        e.status, e.finished_at, e.next_run_at = "stopped", now, None
        await db.commit()
        return "stopped"
    if contact.opted_out:
        e.status, e.finished_at, e.next_run_at = "stopped", now, None
        _note(e, e.step_index, "stopped", "contact opted out")
        await db.commit()
        return "stopped"
    if seq.business_hours_only:
        from app.services.automation.dispatcher import is_open_now  # local import: dispatcher imports this module
        if not is_open_now(tenant.settings or {}):
            e.next_run_at = now + HOURS_RETRY
            await db.commit()
            return "waiting_hours"
    steps = seq.steps or []
    if e.step_index >= len(steps):
        e.status, e.finished_at, e.next_run_at = "completed", now, None
        await db.commit()
        return "completed"

    step, idx = steps[e.step_index], e.step_index
    channel = await _channel(db, e.tenant_id, contact)
    if channel is None:
        e.status, e.finished_at, e.next_run_at, e.last_error = "failed", now, None, "No connected WhatsApp number."
        _note(e, idx, "failed", e.last_error)
        await db.commit()
        return "failed"
    account, conv = channel

    sent, detail = False, ""
    try:
        if step["kind"] == "template":
            sent, detail = await _send_template(db, tenant, account, conv, contact, step.get("template_id"), step.get("variables") or {})
        elif not messaging.window_open(conv):
            if step.get("fallback_template_id"):
                sent, detail = await _send_template(db, tenant, account, conv, contact, step["fallback_template_id"], step.get("variables") or {})
                detail = f"24h window closed, sent template: {detail}"
            else:
                detail = "24h window closed and no fallback template, skipped"
        else:
            if step["kind"] == "ai":
                try:
                    text = await ai_nudge(db, tenant, conv, contact, step.get("instructions") or "", e.sent_count + 1)
                except ai_agent.AIUnavailable as exc:
                    text = templating.render(step.get("text"), contact, {}, business=_business(tenant)) if step.get("text") else ""
                    detail = f"AI unavailable ({exc}); " + ("sent the backup message" if text else "skipped")
            else:
                text = templating.render(step.get("text"), contact, {}, business=_business(tenant))
            if text:
                m = await messaging.send_message(db, account, conv, contact, kind="text", text=text, sender_type="flow",
                                                 extra_payload={"auto": "followup"}, strict=False)
                sent = m.status != "failed"
                detail = detail or (m.error or text[:80])
    except messaging.SendBlocked as exc:
        detail = exc.message

    # send_message commits; re-read the enrollment so a reply that arrived meanwhile isn't overwritten
    await db.refresh(e)
    if e.status != "active":
        return e.status
    if sent:
        e.sent_count += 1
    _note(e, idx, "sent" if sent else "skipped", detail)
    e.step_index = idx + 1
    if e.step_index >= len(steps):
        e.status, e.finished_at, e.next_run_at = "completed", utcnow(), None
    else:
        e.next_run_at = utcnow() + timedelta(minutes=int(steps[e.step_index].get("delay_minutes") or 0))
    await db.commit()
    return "sent" if sent else "skipped"


async def due(db: AsyncSession, limit: int = BATCH) -> list[uuid.UUID]:
    rows = (await db.execute(select(FollowupEnrollment.id).where(
        FollowupEnrollment.status == "active", FollowupEnrollment.next_run_at <= utcnow())
        .order_by(FollowupEnrollment.next_run_at).limit(limit))).scalars().all()
    return list(rows)


async def run_due(session_factory) -> int:
    """One scheduler pass: run every due step, each in its own session so one failure can't block the rest."""
    async with session_factory() as db:
        ids = await due(db)
    n = 0
    for eid in ids:
        async with session_factory() as db:
            e = await db.get(FollowupEnrollment, eid, with_for_update={"skip_locked": True})
            if e is None or e.status != "active" or (e.next_run_at and e.next_run_at > utcnow()):
                continue
            try:
                await run_step(db, e)
                n += 1
            except Exception:  # noqa: BLE001
                log.exception("follow-up step failed for enrollment %s", eid)
                await db.rollback()
    return n
