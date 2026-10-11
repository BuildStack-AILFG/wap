"""
AI lead scoring: hot / warm / cold from what the customer actually said.

Scores arrive two ways: free with every AI agent reply (the agent's JSON carries `lead_score` + `score_reason`, see
ai/agent.py), or on demand from the dashboard (`score_contact`, one short model call over the conversation). A contact turning
hot gets the `hot-lead` tag unless the workspace turned that off (settings.lead_scoring.auto_tag = false), so flows, follow-up
sequences and assignment rules can react to it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.tenant import Tenant
from app.services.ai import agent as ai_agent

SCORES = ("hot", "warm", "cold")
HOT_TAG = "hot-lead"
RANK = case({"hot": 0, "warm": 1, "cold": 2}, value=Contact.lead_score, else_=3)  # ORDER BY: hot first, unscored last

GUIDE = ai_agent.LEAD_GUIDE


def auto_tag_enabled(tenant: Tenant) -> bool:
    return ((tenant.settings or {}).get("lead_scoring") or {}).get("auto_tag", True) is not False


async def apply(db: AsyncSession, tenant: Tenant, contact: Contact, score: object, reason: object = "") -> bool:
    """Store a score if it's valid. Returns True if the contact just became hot. Doesn't commit."""
    score = str(score or "").strip().lower()
    if score not in SCORES:
        return False
    became_hot = score == "hot" and contact.lead_score != "hot"
    contact.lead_score = score
    contact.lead_score_reason = str(reason or "").strip()[:300] or None
    contact.lead_scored_at = datetime.now(timezone.utc)
    if became_hot and auto_tag_enabled(tenant) and HOT_TAG not in {t.lower() for t in (contact.tags or [])}:
        contact.tags = [*(contact.tags or []), HOT_TAG]
        from app.services import followups  # local import: followups -> dispatcher -> ai agent
        await followups.on_tags_added(db, contact, {HOT_TAG})
    return became_hot


async def score_contact(db: AsyncSession, tenant: Tenant, contact: Contact) -> dict:
    """Score from the contact's most recent conversation. Raises ai_agent.AIUnavailable / ValueError. Doesn't commit."""
    conv = (await db.execute(select(Conversation).where(Conversation.contact_id == contact.id)
                             .order_by(Conversation.last_message_at.desc().nulls_last()).limit(1))).scalar_one_or_none()
    history = await ai_agent._history(db, conv) if conv else []  # noqa: SLF001
    if not any(t["role"] == "user" for t in history):
        raise ValueError("This contact hasn't sent any messages yet, so there's nothing to score.")
    conn = ai_agent.connection(tenant)
    await ai_agent._meter(db, tenant, conn.own)  # noqa: SLF001
    system = (
        "You rate how likely a WhatsApp lead is to buy, from the conversation only. " + GUIDE +
        f"\nCustomer name: {contact.name}\n{ai_agent._known(contact)}"  # noqa: SLF001
        'Respond with ONLY a JSON object: {"lead_score": "hot" | "warm" | "cold", "score_reason": one short sentence quoting what they said}.'
    )
    if history[-1]["role"] != "user":
        history = [*history, {"role": "user", "content": "(end of conversation — rate the customer above)"}]
    data = ai_agent._parse_json(await ai_agent.complete(conn.key, system=system, messages=history, model=conn.model, max_tokens=150,  # noqa: SLF001
                                                        provider=conn.provider)) or {}
    if str(data.get("lead_score", "")).lower() not in SCORES:
        raise ValueError("The AI couldn't score this conversation. Try again after a few more messages.")
    await apply(db, tenant, contact, data.get("lead_score"), data.get("score_reason"))
    return {"lead_score": contact.lead_score, "lead_score_reason": contact.lead_score_reason}
