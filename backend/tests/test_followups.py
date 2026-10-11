"""Follow-up sequences: steps run on schedule, a reply stops them, the 24h window is respected, triggers and the recovery list."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest_asyncio
from sqlalchemy import update

from app.models.conversation import Conversation
from app.models.followup import FollowupEnrollment
from app.services import scheduler
from app.services.ai import agent as ai_agent
from tests.conftest import approved_template, db_session
from tests.test_automation import texts

PHONE = "919811112222"


@pytest_asyncio.fixture(autouse=True)
async def _no_leftover_enrollments():
    """The scheduler serves every workspace, so end other tests' still-active enrollments before each test."""
    async with await db_session() as db:
        await db.execute(update(FollowupEnrollment).where(FollowupEnrollment.status == "active").values(status="stopped", next_run_at=None))
        await db.commit()


async def _contact_id(ws, phone: str = PHONE) -> str:
    return next(c["id"] for c in (await ws.get("/contacts")).json()["items"] if c["phone"] == phone)


async def _template_id(ws, meta, name: str = "nudge_offer") -> str:
    meta.templates.append(approved_template(name, body="Hi {{1}}, still interested?", category="MARKETING"))
    await ws.post(f"/whatsapp/accounts/{ws.account['id']}/sync-templates")
    return next(t["id"] for t in (await ws.get("/templates")).json() if t["name"] == name)


async def _sequence(ws, steps: list[dict], **extra) -> dict:
    r = await ws.post("/followups", json={"name": "Silent leads", "steps": steps, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def _enroll(ws, seq_id: str, contact_id: str) -> dict:
    r = await ws.post(f"/followups/{seq_id}/enroll", json={"contact_ids": [contact_id]})
    assert r.status_code == 200, r.text
    return r.json()


async def _make_due(seq_id: str) -> None:
    async with await db_session() as db:
        await db.execute(update(FollowupEnrollment).where(FollowupEnrollment.sequence_id == uuid.UUID(seq_id), FollowupEnrollment.status == "active")
                         .values(next_run_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        await db.commit()


async def _close_window(ws) -> None:
    async with await db_session() as db:
        await db.execute(update(Conversation).where(Conversation.tenant_id == uuid.UUID(ws.tenant_id))
                         .values(last_inbound_at=datetime.now(timezone.utc) - timedelta(hours=30), free_entry_until=None))
        await db.commit()


async def _enrollments(ws, seq_id: str) -> list[dict]:
    return (await ws.get(f"/followups/{seq_id}/enrollments")).json()


async def test_steps_send_in_order_on_schedule_then_complete(wsa, meta):
    await wsa.inbound("what's the price?")
    tid = await _template_id(wsa, meta)
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "Hi {{first_name}}, did you get a chance to look?"},
                                {"kind": "template", "delay_minutes": 60 * 24, "template_id": tid, "variables": {"body": ["{{first_name}}"]}}])
    await _enroll(wsa, seq["id"], await _contact_id(wsa))
    meta.sent.clear()

    await scheduler.tick()
    assert texts(meta) == ["Hi Asha, did you get a chance to look?"]
    await scheduler.tick()  # the second step waits a day
    assert len(meta.sent) == 1

    await _make_due(seq["id"])
    await scheduler.tick()
    await scheduler.tick()  # nothing left to send: no double sends
    assert texts(meta) == ["Hi Asha, did you get a chance to look?", "[template] nudge_offer"]
    e = (await _enrollments(wsa, seq["id"]))[0]
    assert e["status"] == "completed" and e["sent"] == 2

    silent = (await wsa.get("/followups/silent")).json()
    assert [s["phone"] for s in silent] == [PHONE] and silent[0]["followups_sent"] == 2


async def test_a_reply_stops_the_sequence(wsa, meta):
    await wsa.inbound("hi")
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "Following up!"}, {"kind": "text", "delay_minutes": 0, "text": "Last nudge"}])
    await _enroll(wsa, seq["id"], await _contact_id(wsa))
    await scheduler.tick()
    meta.sent.clear()

    await wsa.inbound("yes, tell me more")
    await _make_due(seq["id"])
    await scheduler.tick()
    assert "Last nudge" not in texts(meta)
    assert (await _enrollments(wsa, seq["id"]))[0]["status"] == "replied"
    assert (await wsa.get("/followups/silent")).json() == []
    seq_out = (await wsa.get(f"/followups/{seq['id']}")).json()
    assert seq_out["counts"]["replied"] == 1 and seq_out["reply_rate"] == 1.0


async def test_outside_24h_window_uses_fallback_template_or_skips(wsa, meta):
    await wsa.inbound("hi")
    tid = await _template_id(wsa, meta)
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "Free text", "fallback_template_id": tid, "variables": {"body": ["{{first_name}}"]}},
                                {"kind": "text", "delay_minutes": 0, "text": "No fallback here"}])
    await _enroll(wsa, seq["id"], await _contact_id(wsa))
    await _close_window(wsa)
    meta.sent.clear()

    await scheduler.tick()
    await _make_due(seq["id"])
    await scheduler.tick()
    assert texts(meta) == ["[template] nudge_offer"]  # free text never goes out after 24h
    e = (await _enrollments(wsa, seq["id"]))[0]
    assert e["status"] == "completed" and e["sent"] == 1 and "skipped" in e["log"][-1]["detail"]


async def test_opted_out_contacts_are_never_enrolled_or_messaged(wsa, meta):
    await wsa.inbound("hi")
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "Nudge"}])
    cid = await _contact_id(wsa)
    await _enroll(wsa, seq["id"], cid)
    await wsa.inbound("STOP")  # opting out ends the active enrollment
    assert (await _enrollments(wsa, seq["id"]))[0]["status"] == "stopped"
    assert (await _enroll(wsa, seq["id"], cid)) == {"enrolled": 0, "skipped": 1}
    meta.sent.clear()
    await scheduler.tick()
    assert not meta.sent


async def test_enrolling_twice_is_ignored(wsa):
    await wsa.inbound("hi")
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 30, "text": "Nudge"}])
    cid = await _contact_id(wsa)
    assert (await _enroll(wsa, seq["id"], cid))["enrolled"] == 1
    assert (await _enroll(wsa, seq["id"], cid))["enrolled"] == 0


async def test_adding_a_tag_starts_a_tag_sequence(wsa):
    await wsa.inbound("hi")
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "Nudge"}], trigger="tag", trigger_value="Hot-Lead")
    cid = await _contact_id(wsa)
    assert (await wsa.patch(f"/contacts/{cid}", json={"tags": ["hot-lead"]})).status_code == 200
    assert [e["source"] for e in await _enrollments(wsa, seq["id"])] == ["tag"]
    assert (await wsa.post("/contacts/bulk", json={"ids": [cid], "action": "add_tag", "tag": "hot-lead"})).status_code == 200
    assert len(await _enrollments(wsa, seq["id"])) == 1  # already has the tag and is active: no second enrollment


async def test_ai_step_writes_a_fresh_nudge_from_the_conversation(wsa, meta, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "platform-key")
    seen: dict = {}

    async def complete(api_key, *, system, messages, model=None, max_tokens=700, provider="anthropic"):
        seen.update(system=system, messages=messages)
        return "Hi Asha! Still thinking about the 2BHK in Baner? Happy to share the floor plan."
    monkeypatch.setattr(ai_agent, "complete", complete)

    await wsa.inbound("Is the 2BHK in Baner still available?")
    seq = await _sequence(wsa, [{"kind": "ai", "delay_minutes": 0, "instructions": "Offer the floor plan."}])
    await _enroll(wsa, seq["id"], await _contact_id(wsa))
    meta.sent.clear()
    await scheduler.tick()
    assert texts(meta) == ["Hi Asha! Still thinking about the 2BHK in Baner? Happy to share the floor plan."]
    assert "Offer the floor plan." in seen["system"] and "2BHK in Baner" in seen["messages"][0]["content"]


async def test_sequences_are_validated_and_tenant_scoped(wsa, other):
    assert (await wsa.post("/followups", json={"name": "x", "steps": []})).status_code == 422
    assert (await wsa.post("/followups", json={"name": "x", "steps": [{"kind": "template", "delay_minutes": 0}]})).status_code == 422
    assert (await wsa.post("/followups", json={"name": "x", "trigger": "tag", "steps": [{"kind": "text", "delay_minutes": 0, "text": "hi"}]})).status_code == 422
    seq = await _sequence(wsa, [{"kind": "text", "delay_minutes": 0, "text": "hi"}])
    for call in (other.get(f"/followups/{seq['id']}"), other.post(f"/followups/{seq['id']}/enroll", json={"contact_ids": [str(uuid.uuid4())]}),
                 other.delete(f"/followups/{seq['id']}")):
        assert (await call).status_code == 404
