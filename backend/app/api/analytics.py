"""Analytics + notifications derived from live data (no separate metrics store)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db
from app.models.broadcast import Broadcast
from app.models.contact import Contact
from app.models.conversation import Conversation, Message
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant, User
from app.models.whatsapp_account import WhatsAppAccount
from app.services.entitlements import require_feature
from app.services import quotas
from app.services.ai import agent as ai_agent

router = APIRouter(tags=["analytics"])


def _series(rows: list[tuple], days: int, start: datetime, keys: list[str]) -> list[dict]:
    """Zero-fill a per-day series so charts have a point for every day."""
    by_day = {r[0].isoformat(): r[1:] for r in rows}
    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        vals = by_day.get(d, tuple(0 for _ in keys))
        out.append({"date": d, **{k: int(v or 0) for k, v in zip(keys, vals)}})
    return out


@router.get("/analytics/overview", dependencies=[Depends(require_feature("conversation_analytics"))])
async def overview(days: int = Query(30, ge=1, le=90), ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    t = ctx.tenant_id
    day = cast(Message.created_at, Date)

    msg_rows = (await db.execute(
        select(day, func.count().filter(Message.direction == "in"), func.count().filter((Message.direction == "out") & Message.is_internal.is_(False)))
        .where(Message.tenant_id == t, Message.created_at >= start).group_by(day).order_by(day))).all()
    conv_day = cast(Conversation.created_at, Date)
    conv_rows = (await db.execute(select(conv_day, func.count()).where(Conversation.tenant_id == t, Conversation.created_at >= start).group_by(conv_day).order_by(conv_day))).all()
    con_day = cast(Contact.created_at, Date)
    contact_rows = (await db.execute(select(con_day, func.count()).where(Contact.tenant_id == t, Contact.created_at >= start).group_by(con_day).order_by(con_day))).all()

    m = Message
    delivery = (await db.execute(select(
        func.count().filter(m.status.in_(("sent", "delivered", "read"))), func.count().filter(m.status.in_(("delivered", "read"))), func.count().filter(m.status == "read"),
        func.count().filter(m.status == "failed"),
    ).where(m.tenant_id == t, m.direction == "out", m.is_internal.is_(False), m.created_at >= start))).one()

    # first response time: first outbound message (bot/agent/AI, not broadcast) after the first inbound, per conversation created in range
    first_in = select(Message.conversation_id.label("cid"), func.min(Message.created_at).label("t_in")).where(Message.tenant_id == t, Message.direction == "in", Message.created_at >= start).group_by(Message.conversation_id).subquery()
    first_out = select(Message.conversation_id.label("cid"), func.min(Message.created_at).label("t_out")).where(
        Message.tenant_id == t, Message.direction == "out", Message.is_internal.is_(False), Message.sender_type.in_(("agent", "bot", "ai", "flow"))).group_by(Message.conversation_id).subquery()
    resp = (await db.execute(select(func.avg(func.extract("epoch", first_out.c.t_out - first_in.c.t_in)), func.count()).select_from(first_in.join(first_out, first_in.c.cid == first_out.c.cid))
                             .where(first_out.c.t_out >= first_in.c.t_in))).one()

    conv = (await db.execute(select(
        func.count().filter(Conversation.status == "open"), func.count().filter(Conversation.status == "resolved"), func.count().filter(Conversation.inbox_status == "intervened"),
        func.count().filter(Conversation.assigned_user_id.is_(None) & (Conversation.status == "open")),
    ).where(Conversation.tenant_id == t))).one()

    agents = (await db.execute(
        select(User.id, User.full_name, User.email, func.count(Message.id), func.count(func.distinct(Message.conversation_id)))
        .join(User, User.id == Message.sender_user_id).where(Message.tenant_id == t, Message.created_at >= start, Message.direction == "out", Message.is_internal.is_(False), Message.sender_type == "agent")
        .group_by(User.id, User.full_name, User.email).order_by(func.count(Message.id).desc()).limit(20))).all()

    b = (await db.execute(select(func.count(), func.coalesce(func.sum(Broadcast.total_recipients), 0), func.coalesce(func.sum(Broadcast.sent), 0), func.coalesce(func.sum(Broadcast.delivered), 0),
                                 func.coalesce(func.sum(Broadcast.read), 0), func.coalesce(func.sum(Broadcast.replied), 0), func.coalesce(func.sum(Broadcast.failed), 0))
                        .where(Broadcast.tenant_id == t, Broadcast.created_at >= start, Broadcast.status != "draft"))).one()

    totals = (await db.execute(select(func.count(), func.count().filter(Contact.opted_out.is_(True))).where(Contact.tenant_id == t))).one()
    sent = delivery[0] or 0
    pct = lambda n: round(100 * n / sent, 1) if sent else 0.0  # noqa: E731
    return {
        "days": days,
        "messages": _series(msg_rows, days, start, ["inbound", "outbound"]),
        "conversations_started": _series(conv_rows, days, start, ["count"]),
        "new_contacts": _series(contact_rows, days, start, ["count"]),
        "delivery": {"sent": sent, "delivered": delivery[1], "read": delivery[2], "failed": delivery[3], "delivered_pct": pct(delivery[1]), "read_pct": pct(delivery[2]), "failed_pct": pct(delivery[3])},
        "first_response": {"avg_seconds": round(float(resp[0])) if resp[0] is not None else None, "conversations": resp[1]},
        "conversations": {"open": conv[0], "resolved": conv[1], "human_handled": conv[2], "unassigned": conv[3]},
        "agents": [{"user_id": str(a[0]), "name": a[1] or a[2], "messages": a[3], "conversations": a[4]} for a in agents],
        "campaigns": {"count": b[0], "recipients": int(b[1]), "sent": int(b[2]), "delivered": int(b[3]), "read": int(b[4]), "replied": int(b[5]), "failed": int(b[6])},
        "contacts": {"total": totals[0], "opted_out": totals[1]},
    }


@router.get("/notifications")
async def notifications(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    t, now = ctx.tenant_id, datetime.now(timezone.utc)
    items: list[dict] = []

    unread = (await db.execute(select(func.coalesce(func.sum(Conversation.unread_count), 0), func.count().filter(Conversation.unread_count > 0))
                               .where(Conversation.tenant_id == t, Conversation.status == "open"))).one()
    for a in (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == t, WhatsAppAccount.status == "error"))).scalars():
        items.append({"id": f"acct-{a.id}", "type": "error", "title": "WhatsApp number needs attention", "detail": (a.last_error or "Access token rejected.")[:160], "href": "/dashboard/whatsapp", "at": (a.updated_at or now).isoformat()})
    for a in (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == t, WhatsAppAccount.quality_rating == "RED"))).scalars():
        items.append({"id": f"quality-{a.id}", "type": "warning", "title": "Number quality is RED", "detail": "Sending is at risk — pause marketing campaigns.", "href": "/dashboard/whatsapp", "at": now.isoformat()})
    for b in (await db.execute(select(Broadcast).where(Broadcast.tenant_id == t, Broadcast.status == "failed", Broadcast.created_at > now - timedelta(days=7)).order_by(Broadcast.created_at.desc()).limit(3))).scalars():
        items.append({"id": f"bc-{b.id}", "type": "error", "title": f"Campaign '{b.name}' failed", "detail": (b.error or "")[:160], "href": f"/dashboard/broadcasts/{b.id}", "at": (b.completed_at or b.created_at).isoformat()})
    for tpl in (await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == t, WhatsAppTemplate.is_deleted.is_(False), WhatsAppTemplate.status.in_(("approved", "rejected")),
                                                                 WhatsAppTemplate.updated_at > now - timedelta(days=3)).order_by(WhatsAppTemplate.updated_at.desc()).limit(5))).scalars():
        items.append({"id": f"tpl-{tpl.id}-{tpl.status}", "type": "success" if tpl.status == "approved" else "warning", "title": f"Template '{tpl.name}' {tpl.status}",
                      "detail": (tpl.meta_rejection_reason or "")[:160], "href": "/dashboard/templates", "at": tpl.updated_at.isoformat()})
    tenant = await db.get(Tenant, t)
    if tenant:
        used = ai_agent.usage_this_month(tenant)
        limit = (await quotas.quotas_for(db, t)).get("ai_replies_included_per_month")
        if limit and limit > 0 and used >= 0.8 * limit and ai_agent.get_config(tenant)["enabled"] and not ai_agent.get_config(tenant)["has_own_key"]:
            items.append({"id": "ai-quota", "type": "warning", "title": "AI replies almost used up", "detail": f"{used} of {limit} included replies used this month.", "href": "/dashboard/ai-agent", "at": now.isoformat()})
    items.sort(key=lambda i: i["at"], reverse=True)
    return {"unread_messages": int(unread[0]), "unread_conversations": unread[1], "items": items[:20]}
