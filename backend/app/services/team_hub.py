"""
Team Hub: salespeople use the business WhatsApp number as their work assistant.

A team member saves their own WhatsApp number in Team Hub. When that number messages the business number, the message goes
here instead of the customer automation (flows, AI agent, follow-ups). They can ask "which leads do I call today?", see hot
leads and their open deals, tap a task to see the lead's details, mark it done, push it to tomorrow, add notes, and create
tasks in plain words ("call Rahul tomorrow 5pm"). Everything is free-form inside the 24-hour window the salesperson opens by
writing first, so no templates are needed. A daily summary is sent only while that window is open.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.contact import Contact
from app.models.conversation import Conversation, Message
from app.models.pipeline import Deal, PipelineStage
from app.models.sales_task import SalesTask
from app.models.tenant import Tenant, TenantMembership, User
from app.models.whatsapp_account import WhatsAppAccount
from app.services import pipeline
from app.services.ai import agent as ai_agent
from app.services.whatsapp import messaging

log = logging.getLogger(__name__)

MARKER = "team_hub"
DEFAULT_TZ = "Asia/Kolkata"
LIST_MAX = 10
TASK_KINDS = {"call", "follow_up", "meeting", "other"}
KIND_LABEL = {"call": "Call", "follow_up": "Follow up", "meeting": "Meeting", "other": "Task"}
MENU = [("ta:today", "Today's tasks"), ("ta:hot", "Hot leads"), ("ta:deals", "My deals")]
WORDS = {
    "menu": {"hi", "hii", "hello", "hey", "menu", "help", "start", "options", "namaste"},
    "today": {"today", "tasks", "task", "todo", "to do", "calls", "aaj", "my tasks", "today's tasks", "todays tasks", "leads today", "aaj ke calls"},
    "overdue": {"overdue", "pending", "missed", "late"},
    "hot": {"hot", "hot leads", "hot lead"},
    "deals": {"deals", "my deals", "pipeline", "deal"},
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def tenant_tz(tenant: Tenant) -> ZoneInfo:
    name = ((tenant.settings or {}).get("business_hours") or {}).get("timezone") or (tenant.settings or {}).get("timezone") or DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except Exception:  # noqa: BLE001 — unknown tz name
        return ZoneInfo(DEFAULT_TZ)


def end_of_today(tz: ZoneInfo, now: datetime | None = None) -> datetime:
    local = (now or utcnow()).astimezone(tz)
    return datetime.combine(local.date(), time(23, 59, 59), tzinfo=tz)


def fmt_due(d: datetime | None, tz: ZoneInfo) -> str:
    if d is None:
        return "No time set"
    local, today = d.astimezone(tz), utcnow().astimezone(tz).date()
    day = "Today" if local.date() == today else "Tomorrow" if local.date() == today + timedelta(days=1) else \
        "Yesterday" if local.date() == today - timedelta(days=1) else local.strftime("%d %b")
    return f"{day} {local.strftime('%I:%M %p').lstrip('0')}"


def hub_settings(tenant: Tenant) -> dict:
    cfg = (tenant.settings or {}).get("team_hub") or {}
    return {"daily_summary": cfg.get("daily_summary", True) is not False, "summary_hour": int(cfg.get("summary_hour", 9) or 9)}


# ---- lookups -------------------------------------------------------------------------------------------------------------

async def member_for_phone(db: AsyncSession, tenant_id: uuid.UUID, phone: str) -> tuple[TenantMembership, User] | None:
    if not phone:
        return None
    row = (await db.execute(select(TenantMembership, User).join(User, User.id == TenantMembership.user_id).where(
        TenantMembership.tenant_id == tenant_id, TenantMembership.whatsapp_phone == phone, User.is_active.is_(True)).limit(1))).first()
    return (row[0], row[1]) if row else None


async def tasks_for(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, scope: str, tz: ZoneInfo) -> list[tuple[SalesTask, Contact | None]]:
    """scope: today (open, due by tonight or undated) | overdue (open, due before now) | upcoming (open, after today)."""
    q = select(SalesTask, Contact).outerjoin(Contact, Contact.id == SalesTask.contact_id).where(
        SalesTask.tenant_id == tenant_id, SalesTask.user_id == user_id, SalesTask.status == "open")
    if scope == "today":
        q = q.where(or_(SalesTask.due_at.is_(None), SalesTask.due_at <= end_of_today(tz)))
    elif scope == "overdue":
        q = q.where(SalesTask.due_at < utcnow())
    elif scope == "upcoming":
        q = q.where(SalesTask.due_at > end_of_today(tz))
    q = q.order_by(SalesTask.due_at.asc().nulls_last(), SalesTask.created_at).limit(50)
    return [(t, c) for t, c in (await db.execute(q)).all()]


async def hot_leads_for(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, limit: int = LIST_MAX) -> list[Contact]:
    """Hot contacts this person owns: an open deal they own, or a chat assigned to them."""
    owned = select(Deal.contact_id).where(Deal.tenant_id == tenant_id, Deal.owner_user_id == user_id, Deal.status == "open", Deal.contact_id.is_not(None))
    assigned = select(Conversation.contact_id).where(Conversation.tenant_id == tenant_id, Conversation.assigned_user_id == user_id)
    q = select(Contact).where(Contact.tenant_id == tenant_id, Contact.lead_score == "hot", or_(Contact.id.in_(owned), Contact.id.in_(assigned)))
    return list((await db.execute(q.order_by(Contact.lead_scored_at.desc().nulls_last()).limit(limit))).scalars())


async def deals_for(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, limit: int = LIST_MAX) -> list[tuple[Deal, PipelineStage, Contact | None]]:
    q = (select(Deal, PipelineStage, Contact).join(PipelineStage, PipelineStage.id == Deal.stage_id).outerjoin(Contact, Contact.id == Deal.contact_id)
         .where(Deal.tenant_id == tenant_id, Deal.owner_user_id == user_id, Deal.status == "open").order_by(Deal.updated_at.desc()).limit(limit))
    return [(d, s, c) for d, s, c in (await db.execute(q)).all()]


async def find_contacts(db: AsyncSession, tenant_id: uuid.UUID, query: str, limit: int = 5) -> list[Contact]:
    query = query.strip()
    if len(query) < 2:
        return []
    digits = re.sub(r"\D", "", query)
    cond = Contact.phone.contains(digits) if len(digits) >= 5 else Contact.name.ilike(f"%{query}%")
    return list((await db.execute(select(Contact).where(Contact.tenant_id == tenant_id, cond).order_by(Contact.updated_at.desc()).limit(limit))).scalars())


async def stats_for(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, tz: ZoneInfo) -> dict:
    now, eod = utcnow(), end_of_today(tz)
    sod = eod - timedelta(days=1)
    base = select(func.count()).select_from(SalesTask).where(SalesTask.tenant_id == tenant_id, SalesTask.user_id == user_id)
    return {
        "today": (await db.execute(base.where(SalesTask.status == "open", or_(SalesTask.due_at.is_(None), SalesTask.due_at <= eod)))).scalar_one(),
        "overdue": (await db.execute(base.where(SalesTask.status == "open", SalesTask.due_at < now))).scalar_one(),
        "done_today": (await db.execute(base.where(SalesTask.status == "done", SalesTask.done_at > sod))).scalar_one(),
        "open_deals": (await db.execute(select(func.count()).select_from(Deal).where(
            Deal.tenant_id == tenant_id, Deal.owner_user_id == user_id, Deal.status == "open"))).scalar_one(),
        "hot_leads": len(await hot_leads_for(db, tenant_id, user_id, limit=50)),
    }


# ---- task actions (shared by the API and WhatsApp) ----------------------------------------------------------------------

async def create_task(db: AsyncSession, tenant_id: uuid.UUID, *, title: str, user_id: uuid.UUID | None, created_by: uuid.UUID | None, kind: str = "call",
                      due_at: datetime | None = None, contact_id: uuid.UUID | None = None, deal_id: uuid.UUID | None = None,
                      notes: str | None = None, source: str = "dashboard") -> SalesTask:
    if deal_id is None and contact_id is not None:
        deal = await pipeline.deal_for_contact(db, tenant_id, contact_id)
        deal_id = deal.id if deal else None
    t = SalesTask(tenant_id=tenant_id, user_id=user_id, created_by=created_by, title=title.strip()[:200] or "Call", kind=kind if kind in TASK_KINDS else "call",
                  due_at=due_at, contact_id=contact_id, deal_id=deal_id, notes=(notes or "").strip() or None, source=source, status="open")
    db.add(t)
    await db.flush()
    return t


async def add_note(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID | None, text: str, *, task: SalesTask | None = None, contact_id: uuid.UUID | None = None) -> None:
    """Save a note on the task, on the lead's open deal and as an internal note in the lead's chat (so the whole team sees it)."""
    text = text.strip()[:1000]
    if not text:
        return
    stamp = utcnow().strftime("%d %b")
    if task is not None:
        task.notes = f"{task.notes}\n{stamp}: {text}" if task.notes else f"{stamp}: {text}"
        contact_id = contact_id or task.contact_id
    deal = await db.get(Deal, task.deal_id) if task is not None and task.deal_id else (await pipeline.deal_for_contact(db, tenant_id, contact_id) if contact_id else None)
    if deal is not None and deal.tenant_id == tenant_id:
        await pipeline.add_note(db, deal, text, user_id)
    if contact_id:
        conv = (await db.execute(select(Conversation).where(Conversation.tenant_id == tenant_id, Conversation.contact_id == contact_id)
                                 .order_by(Conversation.last_message_at.desc().nulls_last()).limit(1))).scalar_one_or_none()
        if conv is not None:
            db.add(Message(tenant_id=tenant_id, conversation_id=conv.id, direction="out", type="text", body=f"Note (via WhatsApp): {text}", status="sent",
                           sender_type="agent", sender_user_id=user_id, is_internal=True))


def mark_done(task: SalesTask) -> None:
    task.status, task.done_at = "done", utcnow()


def push_to_tomorrow(task: SalesTask, tz: ZoneInfo) -> None:
    base = (task.due_at or utcnow()).astimezone(tz)
    tomorrow = utcnow().astimezone(tz).date() + timedelta(days=1)
    task.due_at = datetime.combine(tomorrow, base.time() if task.due_at else time(10, 0), tzinfo=tz)


def task_out(t: SalesTask, contact: Contact | None = None, user: User | None = None) -> dict:
    return {"id": str(t.id), "title": t.title, "kind": t.kind, "status": t.status, "notes": t.notes, "source": t.source,
            "due_at": t.due_at.isoformat() if t.due_at else None, "done_at": t.done_at.isoformat() if t.done_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "user_id": str(t.user_id) if t.user_id else None, "user_name": (user.full_name or user.email) if user else None,
            "deal_id": str(t.deal_id) if t.deal_id else None,
            "contact": {"id": str(contact.id), "name": contact.name, "phone": contact.phone, "lead_score": contact.lead_score} if contact else None}


# ---- WhatsApp conversation ----------------------------------------------------------------------------------------------

class _Chat:
    """One inbound message from a team member, with helpers to answer them."""

    def __init__(self, db, tenant, account, conv, contact, membership, user):
        self.db, self.tenant, self.account, self.conv, self.contact = db, tenant, account, conv, contact
        self.m, self.user, self.tz = membership, user, tenant_tz(tenant)
        self.first_name = ((user.full_name or "").split() or ["there"])[0]

    async def text(self, body: str) -> None:
        await self._send(kind="text", text=body[:4000])

    async def buttons(self, body: str, buttons: list[tuple[str, str]]) -> None:
        inter = messaging.buttons_interactive(body[:1024], [{"id": i, "title": t} for i, t in buttons[:3]])
        await self._send(kind="interactive", interactive=inter, text=body[:1024])

    async def rows(self, body: str, button: str, rows: list[tuple[str, str, str]]) -> None:
        inter = messaging.list_interactive(body[:1024], button, [{"title": "Choose one", "rows": [
            {"id": i, "title": t, "description": d} for i, t, d in rows[:LIST_MAX]]}])
        await self._send(kind="interactive", interactive=inter, text=body[:1024])

    async def _send(self, **kw) -> None:
        try:
            msg = await messaging.send_message(self.db, self.account, self.conv, self.contact, sender_type="bot", extra_payload={"auto": MARKER}, strict=False, **kw)
            if kw.get("kind") == "interactive" and msg.status == "failed":  # fall back to plain text
                await messaging.send_message(self.db, self.account, self.conv, self.contact, kind="text", text=kw.get("text") or "", sender_type="bot",
                                             extra_payload={"auto": MARKER}, strict=False)
        except messaging.SendBlocked as exc:
            log.info("team hub reply blocked: %s", exc.message)

    def set_state(self, **kv) -> None:
        self.m.assistant_state = {**(self.m.assistant_state or {}), **kv}
        flag_modified(self.m, "assistant_state")

    def clear_state(self, *keys: str) -> None:
        st = dict(self.m.assistant_state or {})
        for k in keys:
            st.pop(k, None)
        self.m.assistant_state = st
        flag_modified(self.m, "assistant_state")

    async def own_task(self, tid: str) -> SalesTask | None:
        try:
            t = await self.db.get(SalesTask, uuid.UUID(tid))
        except ValueError:
            return None
        return t if t is not None and t.tenant_id == self.tenant.id else None

    async def own_contact(self, cid: str) -> Contact | None:
        try:
            c = await self.db.get(Contact, uuid.UUID(cid))
        except ValueError:
            return None
        return c if c is not None and c.tenant_id == self.tenant.id else None

    # -- screens --

    async def menu(self, intro: str | None = None) -> None:
        s = await stats_for(self.db, self.tenant.id, self.user.id, self.tz)
        body = intro or f"Hi {self.first_name}! 👋"
        body += f"\n\nToday: {s['today']} task{'s' if s['today'] != 1 else ''}" + (f" ({s['overdue']} overdue)" if s["overdue"] else "")
        body += f" · {s['hot_leads']} hot lead{'s' if s['hot_leads'] != 1 else ''} · {s['open_deals']} open deal{'s' if s['open_deals'] != 1 else ''}"
        body += "\n\nYou can also type things like \"call Rahul tomorrow 5pm\" or \"find Priya\"."
        await self.buttons(body, MENU)

    async def task_list(self, scope: str = "today") -> None:
        items = await tasks_for(self.db, self.tenant.id, self.user.id, scope, self.tz)
        if not items:
            msg = {"today": "No tasks left for today 🎉", "overdue": "Nothing overdue. Nice!", "upcoming": "No upcoming tasks."}[scope]
            await self.buttons(msg + " Want to check your hot leads?", [("ta:hot", "Hot leads"), ("ta:deals", "My deals"), ("ta:menu", "Menu")])
            return
        overdue = sum(1 for t, _ in items if t.due_at and t.due_at < utcnow())
        head = {"today": f"You have {len(items)} task{'s' if len(items) != 1 else ''} today", "overdue": f"{len(items)} overdue task{'s' if len(items) != 1 else ''}",
                "upcoming": f"{len(items)} upcoming task{'s' if len(items) != 1 else ''}"}[scope]
        if scope == "today" and overdue:
            head += f" ({overdue} overdue)"
        lines = [f"{i}. {(c.name if c else t.title)[:40]} · {fmt_due(t.due_at, self.tz)}" for i, (t, c) in enumerate(items[:LIST_MAX], 1)]
        more = f"\n…and {len(items) - LIST_MAX} more in Team Hub." if len(items) > LIST_MAX else ""
        rows = [(f"ta:task:{t.id}", (c.name if c else t.title)[:24], f"{KIND_LABEL.get(t.kind, 'Task')} · {fmt_due(t.due_at, self.tz)}"
                 + (f" · {c.lead_score}" if c and c.lead_score else "")) for t, c in items[:LIST_MAX]]
        await self.rows(f"{head}:\n\n" + "\n".join(lines) + more + "\n\nTap below to open one.", "Open a task", rows)

    async def task_detail(self, t: SalesTask) -> None:
        c = await self.db.get(Contact, t.contact_id) if t.contact_id else None
        parts = [f"*{t.title}*", f"{KIND_LABEL.get(t.kind, 'Task')} · {fmt_due(t.due_at, self.tz)}" + (" · done ✅" if t.status == "done" else "")]
        if c:
            parts.append(await self._lead_card(c))
        if t.notes:
            parts.append(f"Notes:\n{t.notes[-400:]}")
        if t.status == "done":
            await self.buttons("\n\n".join(parts), [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
        else:
            await self.buttons("\n\n".join(parts), [(f"ta:done:{t.id}", "Done ✅"), (f"ta:later:{t.id}", "Tomorrow"), (f"ta:note:{t.id}", "Add note")])

    async def _lead_card(self, c: Contact) -> str:
        lines = [f"👤 {c.name}", f"📞 +{c.phone}  (wa.me/{c.phone})"]
        if c.lead_score:
            lines.append(f"🔥 {c.lead_score.title()} lead" + (f": {c.lead_score_reason}" if c.lead_score_reason else ""))
        deal = await pipeline.deal_for_contact(self.db, self.tenant.id, c.id)
        if deal is not None:
            stage = await self.db.get(PipelineStage, deal.stage_id)
            lines.append(f"💼 {deal.title} · {stage.name if stage else ''}" + (f" · ₹{deal.value // 100:,}" if deal.value else ""))
        last = (await self.db.execute(select(Message.body, Message.created_at).join(Conversation, Conversation.id == Message.conversation_id).where(
            Conversation.contact_id == c.id, Message.direction == "in", Message.body.is_not(None)).order_by(Message.created_at.desc()).limit(1))).first()
        if last:
            lines.append(f"💬 Last message ({fmt_due(last.created_at, self.tz)}): \"{last.body[:120]}\"")
        known = {k: v for k, v in (c.custom_fields or {}).items() if isinstance(v, (str, int, float)) and str(v).strip()}
        if known:
            lines.append("ℹ️ " + ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in list(known.items())[:4]))
        return "\n".join(lines)

    async def contact_detail(self, c: Contact) -> None:
        await self.buttons(await self._lead_card(c), [(f"ta:addcall:{c.id}", "Add call today"), (f"ta:cnote:{c.id}", "Add note"), ("ta:menu", "Menu")])

    async def hot(self) -> None:
        leads = await hot_leads_for(self.db, self.tenant.id, self.user.id)
        if not leads:
            await self.buttons("No hot leads assigned to you right now.", [("ta:today", "Today's tasks"), ("ta:deals", "My deals"), ("ta:menu", "Menu")])
            return
        rows = [(f"ta:contact:{c.id}", c.name[:24], (c.lead_score_reason or f"+{c.phone}")[:72]) for c in leads]
        lines = [f"{i}. {c.name} · +{c.phone}" for i, c in enumerate(leads, 1)]
        await self.rows(f"🔥 Your hot leads:\n\n" + "\n".join(lines) + "\n\nTap one to see details.", "Open a lead", rows)

    async def deals(self) -> None:
        items = await deals_for(self.db, self.tenant.id, self.user.id)
        if not items:
            await self.buttons("You have no open deals.", [("ta:today", "Today's tasks"), ("ta:hot", "Hot leads"), ("ta:menu", "Menu")])
            return
        rows = [(f"ta:contact:{c.id}" if c else f"ta:deal:{d.id}", (c.name if c else d.title)[:24], f"{s.name}" + (f" · ₹{d.value // 100:,}" if d.value else ""))
                for d, s, c in items]
        lines = [f"{i}. {d.title} · {s.name}" + (f" · ₹{d.value // 100:,}" if d.value else "") for i, (d, s, c) in enumerate(items, 1)]
        await self.rows("💼 Your open deals:\n\n" + "\n".join(lines), "Open a deal", rows)

    async def search(self, query: str) -> None:
        found = await find_contacts(self.db, self.tenant.id, query)
        if not found:
            await self.buttons(f"I couldn't find \"{query[:40]}\" in your contacts.", MENU)
        elif len(found) == 1:
            await self.contact_detail(found[0])
        else:
            await self.rows(f"Found {len(found)} matches for \"{query[:40]}\":", "Pick one",
                            [(f"ta:contact:{c.id}", c.name[:24], f"+{c.phone}") for c in found])


def _ask_ai_prompt(now_local: datetime) -> str:
    return (
        "You turn a salesperson's WhatsApp message to their CRM assistant into ONE command. Today is "
        f"{now_local.strftime('%A %d %B %Y, %I:%M %p')} (their local time).\n"
        "Commands: today (their tasks/calls for today), overdue, upcoming, hot (hot leads), deals (their open deals), "
        "find (look up a lead: put the name or phone in \"query\"), add_task (create a task: \"title\", optional \"query\" = lead name/phone, "
        "\"kind\" = call|follow_up|meeting|other, \"due\" = local datetime YYYY-MM-DDTHH:MM, default 10:00 if only a day is given), "
        "log (they report on a lead, e.g. 'called Rahul, interested, call back Friday': \"query\" = lead, \"note\" = what happened, "
        "optional \"due\" for the next follow-up), menu (greeting, help or anything else).\n"
        'Reply with ONLY JSON: {"command": string, "query": string, "title": string, "kind": string, "due": string, "note": string}.'
    )


async def _ai_command(tenant: Tenant, text: str, tz: ZoneInfo, db: AsyncSession) -> dict | None:
    if not ai_agent.get_config(tenant)["enabled"]:
        return None
    try:
        conn = ai_agent.connection(tenant)
        await ai_agent._meter(db, tenant, conn.own)  # noqa: SLF001 — counts toward the workspace's AI replies like other AI calls
        raw = await ai_agent.complete(conn.key, system=_ask_ai_prompt(utcnow().astimezone(tz)), messages=[{"role": "user", "content": text[:800]}],
                                      model=conn.model, provider=conn.provider, max_tokens=200)
    except Exception as exc:  # noqa: BLE001 — AI is optional here
        log.info("team hub AI unavailable: %s", exc)
        return None
    m = re.search(r"\{.*\}", raw or "", re.DOTALL)
    try:
        data = json.loads(m.group(0)) if m else None
    except json.JSONDecodeError:
        data = None
    return data if isinstance(data, dict) else None


def _parse_due(raw: str | None, tz: ZoneInfo) -> datetime | None:
    if not raw:
        return None
    try:
        d = datetime.fromisoformat(str(raw).strip()[:16])
    except ValueError:
        return None
    return d.replace(tzinfo=tz) if d.tzinfo is None else d


def _simple_due(text: str, tz: ZoneInfo) -> datetime:
    """No AI: 'tomorrow' -> tomorrow 10:00, otherwise later today (an hour from now)."""
    now = utcnow().astimezone(tz)
    if re.search(r"\b(tomorrow|kal)\b", text, re.I):
        return datetime.combine(now.date() + timedelta(days=1), time(10, 0), tzinfo=tz)
    return now + timedelta(hours=1)


async def handle_inbound(db: AsyncSession, tenant: Tenant, account: WhatsAppAccount, conv: Conversation, contact: Contact, msg: Message) -> bool:
    """If the sender is a team member, answer as their assistant and return True (customer automation is skipped)."""
    found = await member_for_phone(db, tenant.id, contact.phone)
    if found is None or not found[0].assistant_enabled:
        return False
    membership, user = found
    chat = _Chat(db, tenant, account, conv, contact, membership, user)
    if "team" not in (conv.labels or []):
        conv.labels = sorted({*(conv.labels or []), "team"})
    reply_id = str((msg.payload or {}).get("reply_id") or "")
    text = (msg.body or "").strip()
    try:
        await _route(chat, reply_id, text)
    finally:
        await db.commit()
    return True


async def _route(chat: _Chat, reply_id: str, text: str) -> None:
    db, tid, uid = chat.db, chat.tenant.id, chat.user.id
    # 1 — taps on our buttons / list rows
    if reply_id.startswith("ta:"):
        chat.clear_state("await_note", "await_cnote")
        parts = reply_id.split(":", 2)
        action, arg = parts[1], parts[2] if len(parts) > 2 else ""
        if action == "menu":
            return await chat.menu()
        if action in {"today", "overdue", "upcoming"}:
            return await chat.task_list(action)
        if action == "hot":
            return await chat.hot()
        if action == "deals":
            return await chat.deals()
        if action == "contact" and (c := await chat.own_contact(arg)):
            return await chat.contact_detail(c)
        if action == "deal":
            d = await db.get(Deal, uuid.UUID(arg)) if arg else None
            if d is not None and d.tenant_id == tid:
                return await chat.text(f"💼 {d.title}" + (f" · ₹{d.value // 100:,}" if d.value else "") + (f"\n{d.notes}" if d.notes else ""))
        if action == "addcall" and (c := await chat.own_contact(arg)):
            t = await create_task(db, tid, title=f"Call {c.name}", user_id=uid, created_by=uid, contact_id=c.id,
                                  due_at=utcnow().astimezone(chat.tz) + timedelta(hours=1), source="whatsapp")
            return await chat.buttons(f"Added: call {c.name} · {fmt_due(t.due_at, chat.tz)}", [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
        if action == "cnote" and (c := await chat.own_contact(arg)):
            chat.set_state(await_cnote=str(c.id))
            return await chat.text(f"Type your note for {c.name}:")
        t = await chat.own_task(arg) if arg else None
        if t is None:
            return await chat.menu("That item isn't available any more.")
        if action == "task":
            return await chat.task_detail(t)
        if action == "done":
            mark_done(t)
            await db.flush()
            left = len(await tasks_for(db, tid, uid, "today", chat.tz))
            return await chat.buttons(f"Marked done ✅ {left} task{'s' if left != 1 else ''} left today.",
                                      [("ta:today", "Next task"), (f"ta:note:{t.id}", "Add note"), ("ta:menu", "Menu")])
        if action == "later":
            push_to_tomorrow(t, chat.tz)
            return await chat.buttons(f"Moved to {fmt_due(t.due_at, chat.tz)}.", [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
        if action == "note":
            chat.set_state(await_note=str(t.id))
            return await chat.text("Type your note (what happened on the call):")
        return await chat.menu()

    # 2 — waiting for a note
    state = chat.m.assistant_state or {}
    if text and state.get("await_note"):
        t = await chat.own_task(state["await_note"])
        chat.clear_state("await_note")
        if t is not None:
            await add_note(db, tid, uid, text, task=t)
            return await chat.buttons("Note saved 📝", [(f"ta:done:{t.id}", "Mark done"), ("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
    if text and state.get("await_cnote"):
        c = await chat.own_contact(state["await_cnote"])
        chat.clear_state("await_cnote")
        if c is not None:
            await add_note(db, tid, uid, text, contact_id=c.id)
            return await chat.buttons(f"Note saved for {c.name} 📝", [(f"ta:addcall:{c.id}", "Add call today"), ("ta:menu", "Menu")])

    low = re.sub(r"[^\w\s']", " ", text.lower()).strip()
    low = re.sub(r"\s+", " ", low)
    if not low:
        return await chat.menu()
    # 3 — short exact commands
    for cmd in ("menu", "today", "overdue", "hot", "deals"):
        if low in WORDS[cmd]:
            return await (chat.menu() if cmd == "menu" else chat.hot() if cmd == "hot" else chat.deals() if cmd == "deals" else chat.task_list(cmd))
    # 4 — plain language via the workspace's AI
    ai = await _ai_command(chat.tenant, text, chat.tz, db)
    if ai:
        cmd = str(ai.get("command") or "").lower()
        if cmd in {"today", "overdue", "upcoming"}:
            return await chat.task_list(cmd)
        if cmd == "hot":
            return await chat.hot()
        if cmd == "deals":
            return await chat.deals()
        if cmd == "find" and ai.get("query"):
            return await chat.search(str(ai["query"]))
        if cmd in {"add_task", "log"}:
            lead = (await find_contacts(db, tid, str(ai.get("query") or ""), limit=1) or [None])[0] if ai.get("query") else None
            due = _parse_due(ai.get("due"), chat.tz)
            if cmd == "log":
                open_task = (await db.execute(select(SalesTask).where(SalesTask.tenant_id == tid, SalesTask.user_id == uid, SalesTask.status == "open",
                                                                       SalesTask.contact_id == lead.id).order_by(SalesTask.due_at.asc().nulls_last()).limit(1))).scalar_one_or_none() if lead else None
                note = str(ai.get("note") or text)
                if open_task is not None:
                    await add_note(db, tid, uid, note, task=open_task)
                    mark_done(open_task)
                elif lead is not None:
                    await add_note(db, tid, uid, note, contact_id=lead.id)
                reply = f"Saved for {lead.name} 📝" if lead else "Saved 📝"
                if open_task is not None:
                    reply += " Task marked done ✅"
                if due is not None:
                    t = await create_task(db, tid, title=f"Follow up {lead.name}" if lead else "Follow up", kind="follow_up", user_id=uid, created_by=uid,
                                          contact_id=lead.id if lead else None, due_at=due, source="whatsapp")
                    reply += f"\nNext follow-up: {fmt_due(t.due_at, chat.tz)}"
                return await chat.buttons(reply, [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
            title = str(ai.get("title") or text)[:200]
            t = await create_task(db, tid, title=title, kind=str(ai.get("kind") or "call"), user_id=uid, created_by=uid,
                                  contact_id=lead.id if lead else None, due_at=due or _simple_due(text, chat.tz), source="whatsapp")
            return await chat.buttons(f"Task added ✅\n{t.title}\n{fmt_due(t.due_at, chat.tz)}" + (f" · {lead.name}" if lead else ""),
                                      [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
        if cmd == "menu":
            return await chat.menu()
    # 5 — no AI: simple word matching
    if any(w in low for w in ("overdue", "pending", "missed")):
        return await chat.task_list("overdue")
    if "hot" in low:
        return await chat.hot()
    if "deal" in low or "pipeline" in low:
        return await chat.deals()
    if re.match(r"^(add task|task|remind|reminder|call)\b", low) and len(low.split()) > 1:
        title = re.sub(r"^(add task|task|remind me to|remind|reminder)\s*:?\s*", "", text, flags=re.I).strip() or text
        t = await create_task(db, tid, title=title, user_id=uid, created_by=uid, due_at=_simple_due(text, chat.tz), source="whatsapp")
        return await chat.buttons(f"Task added ✅\n{t.title}\n{fmt_due(t.due_at, chat.tz)}", [("ta:today", "Today's tasks"), ("ta:menu", "Menu")])
    if any(w in low for w in ("today", "task", "call", "lead", "aaj", "todo")):
        return await chat.task_list("today")
    if (m := re.match(r"^(find|search|lead|details?|show)\s+(.+)$", low)):
        return await chat.search(m.group(2))
    if len(low) <= 40:
        found = await find_contacts(db, tid, text, limit=5)
        if found:
            return await chat.search(text)
    return await chat.menu("Sorry, I didn't get that. Here's what I can do:")


# ---- daily summary ------------------------------------------------------------------------------------------------------

_last_summary_pass: datetime | None = None
SUMMARY_EVERY = timedelta(minutes=5)


async def send_daily_summaries(session_factory, *, force: bool = False) -> int:
    """Once a day at the workspace's summary hour, message each team member their task list. Free-form only, so it is sent
    only while the member's 24-hour window is open (they wrote to the business number in the last day); no template needed."""
    global _last_summary_pass
    if not force and _last_summary_pass and utcnow() - _last_summary_pass < SUMMARY_EVERY:
        return 0
    _last_summary_pass = utcnow()
    sent = 0
    async with session_factory() as db:
        rows = (await db.execute(select(TenantMembership.id).where(TenantMembership.whatsapp_phone.is_not(None),
                                                                    TenantMembership.assistant_enabled.is_(True)))).scalars().all()
    for mid in rows:
        async with session_factory() as db:
            try:
                if await _summary_for(db, mid):
                    sent += 1
            except Exception:  # noqa: BLE001
                log.exception("team hub summary failed for membership %s", mid)
                await db.rollback()
    return sent


async def _summary_for(db: AsyncSession, membership_id: uuid.UUID) -> bool:
    m = await db.get(TenantMembership, membership_id)
    tenant = await db.get(Tenant, m.tenant_id) if m else None
    if m is None or tenant is None or not hub_settings(tenant)["daily_summary"]:
        return False
    tz = tenant_tz(tenant)
    local = utcnow().astimezone(tz)
    today = local.date().isoformat()
    if local.hour < hub_settings(tenant)["summary_hour"] or (m.assistant_state or {}).get("summary_date") == today:
        return False
    contact = (await db.execute(select(Contact).where(Contact.tenant_id == tenant.id, Contact.phone == m.whatsapp_phone))).scalar_one_or_none()
    conv = (await db.execute(select(Conversation).where(Conversation.tenant_id == tenant.id, Conversation.contact_id == contact.id)
                             .order_by(Conversation.last_inbound_at.desc().nulls_last()).limit(1))).scalar_one_or_none() if contact else None
    m.assistant_state = {**(m.assistant_state or {}), "summary_date": today}
    flag_modified(m, "assistant_state")
    if conv is None or not messaging.window_open(conv):
        await db.commit()
        return False
    account, user = await db.get(WhatsAppAccount, conv.account_id), await db.get(User, m.user_id)
    if account is None or account.status == "disconnected" or user is None:
        await db.commit()
        return False
    chat = _Chat(db, tenant, account, conv, contact, m, user)
    await chat.text(f"Good morning {chat.first_name}! ☀️ Here's your day.")
    await chat.task_list("today")
    await db.commit()
    return True
