"""AI lead scoring: free with every AI reply, on demand from the dashboard, hot-first sorting and the hot-lead tag."""

from __future__ import annotations

import json

from app.services.ai import agent as ai_agent
from tests.test_automation import _enable_ai


def fake_llm(monkeypatch, payload: dict):
    async def complete(api_key, *, system, messages, model=None, max_tokens=700, provider="anthropic"):
        return json.dumps(payload)
    monkeypatch.setattr(ai_agent, "complete", complete)


async def _contact(ws, phone: str) -> dict:
    return next(c for c in (await ws.get("/contacts")).json()["items"] if c["phone"] == phone)


async def test_ai_reply_scores_the_lead_and_tags_hot_ones(wsa, meta, monkeypatch):
    await _enable_ai(wsa)
    fake_llm(monkeypatch, {"reply": "It's 45 lakh. Want to visit Saturday?", "confidence": 0.9, "lead_score": "HOT", "score_reason": "Asked price and wants a visit."})
    await wsa.inbound("What's the price of the 2BHK? Can I visit this weekend?", from_="919800000101")
    c = await _contact(wsa, "919800000101")
    assert c["lead_score"] == "hot" and c["lead_score_reason"] == "Asked price and wants a visit." and "hot-lead" in c["tags"]

    fake_llm(monkeypatch, {"reply": "Sure, take your time.", "confidence": 0.9, "lead_score": "maybe"})  # invalid scores are ignored
    await wsa.inbound("ok will think", from_="919800000101")
    assert (await _contact(wsa, "919800000101"))["lead_score"] == "hot"


async def test_hot_lead_tag_can_start_a_followup_sequence(wsa, meta, monkeypatch):
    seq = (await wsa.post("/followups", json={"name": "Hot leads", "trigger": "tag", "trigger_value": "hot-lead",
                                              "steps": [{"kind": "text", "delay_minutes": 120, "text": "Shall I book your visit?"}]})).json()
    await _enable_ai(wsa)
    fake_llm(monkeypatch, {"reply": "Yes!", "confidence": 0.9, "lead_score": "hot", "score_reason": "Ready to book."})
    await wsa.inbound("I want to book now", from_="919800000102")
    assert [e["source"] for e in (await wsa.get(f"/followups/{seq['id']}/enrollments")).json()] == ["tag"]


async def test_auto_tag_can_be_turned_off(wsa, meta, monkeypatch):
    assert (await wsa.patch("/settings", json={"settings": {"lead_scoring": {"auto_tag": False}}})).status_code == 200
    await _enable_ai(wsa)
    fake_llm(monkeypatch, {"reply": "Yes!", "confidence": 0.9, "lead_score": "hot"})
    await wsa.inbound("book it", from_="919800000103")
    c = await _contact(wsa, "919800000103")
    assert c["lead_score"] == "hot" and "hot-lead" not in c["tags"]


async def test_score_on_demand_and_hot_first_sorting(wsa, meta, monkeypatch):
    for phone in ("919800000201", "919800000202", "919800000203"):
        await wsa.inbound("hello", from_=phone)
    cold, hot = await _contact(wsa, "919800000201"), await _contact(wsa, "919800000203")
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "platform-key")

    fake_llm(monkeypatch, {"lead_score": "cold", "score_reason": "Just said hello."})
    r = await wsa.post(f"/contacts/{cold['id']}/score")
    assert r.status_code == 200 and r.json()["lead_score"] == "cold"
    fake_llm(monkeypatch, {"lead_score": "hot", "score_reason": "Asked to pay."})
    assert (await wsa.post(f"/contacts/{hot['id']}/score")).json()["lead_score"] == "hot"

    order = [c["phone"] for c in (await wsa.get("/contacts", params={"sort": "hot_first"})).json()["items"]]
    assert order[0] == "919800000203" and order[1] == "919800000201" and order[2] == "919800000202"  # unscored last
    assert [c["phone"] for c in (await wsa.get("/contacts", params={"lead_score": "hot"})).json()["items"]] == ["919800000203"]
    inbox = (await wsa.get("/inbox/conversations", params={"sort": "hot_first"})).json()["items"]
    assert inbox[0]["contact"]["phone"] == "919800000203" and inbox[0]["contact"]["lead_score"] == "hot"


async def test_score_on_demand_needs_a_conversation(wsa, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "platform-key")
    c = (await wsa.post("/contacts", json={"name": "New", "phone": "919800000301"})).json()
    r = await wsa.post(f"/contacts/{c['id']}/score")
    assert r.status_code == 422 and "nothing to score" in r.json()["detail"]["error"]
