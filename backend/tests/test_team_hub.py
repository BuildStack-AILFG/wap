"""Team Hub: a salesperson messages the business number and gets their tasks, leads and deals back over WhatsApp."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services import team_hub
from tests.conftest import db_session

REP = "919800055501"


async def _me(ws) -> dict:
    return next(m for m in (await ws.get("/team-hub/overview")).json()["members"] if m["is_you"])


async def _register_rep(ws, phone: str = REP) -> dict:
    me = await _me(ws)
    r = await ws.patch(f"/team-hub/members/{me['user_id']}", json={"whatsapp_phone": "+" + phone})
    assert r.status_code == 200, r.text
    return me


def _last(meta) -> dict:
    return meta.sent[-1]


def _body(m: dict) -> str:
    return m["text"]["body"] if m["type"] == "text" else m["interactive"]["body"]["text"]


def _tap(kind: str, id_: str, title: str = "x") -> dict:
    return {"interactive": {"type": kind, kind: {"id": id_, "title": title}}}


async def test_rep_number_validation(wsa):
    me = await _me(wsa)
    r = await wsa.patch(f"/team-hub/members/{me['user_id']}", json={"whatsapp_phone": "123"})
    assert r.status_code == 422
    r = await wsa.patch(f"/team-hub/members/{me['user_id']}", json={"whatsapp_phone": "98000 55501"})  # national -> default +91
    assert r.status_code == 200 and r.json()["whatsapp_phone"] == REP
    assert (await _me(wsa))["whatsapp_phone"] == REP


async def test_rep_gets_menu_not_the_customer_bot(wsa, meta):
    await _register_rep(wsa)
    await wsa.inbound("hi", from_=REP, name="Rep")
    assert len(meta.sent) == 1
    m = _last(meta)
    assert m["type"] == "interactive" and [b["reply"]["title"] for b in m["interactive"]["action"]["buttons"]] == ["Today's tasks", "Hot leads", "My deals"]
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    assert "team" in conv["labels"]


async def test_customer_numbers_are_not_affected(wsa, meta):
    await _register_rep(wsa)
    await wsa.inbound("hi", from_="919811112222")
    assert all((m.get("interactive") or {}).get("body", {}).get("text", "").find("Today:") == -1 for m in meta.sent)


async def test_today_list_open_task_mark_done_and_note(wsa, meta):
    me = await _register_rep(wsa)
    await wsa.inbound("Hello, I want pricing", from_="919811177777", name="Rahul Sharma")  # creates the lead
    contact = next(c for c in (await wsa.get("/contacts")).json()["items"] if c["phone"] == "919811177777")
    due = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    r = await wsa.post("/team-hub/tasks", json={"title": "Call Rahul about pricing", "contact_id": contact["id"], "due_at": due, "user_id": me["user_id"]})
    assert r.status_code == 201, r.text
    task = r.json()
    meta.sent.clear()

    await wsa.inbound("Which leads do I need to call today?", from_=REP)
    m = _last(meta)
    assert m["interactive"]["type"] == "list" and "1 task today" in _body(m)
    rows = m["interactive"]["action"]["sections"][0]["rows"]
    assert rows[0]["id"] == f"ta:task:{task['id']}" and rows[0]["title"] == "Rahul Sharma"

    await wsa.inbound("", from_=REP, msg_type="interactive", extra=_tap("list_reply", rows[0]["id"]))
    m = _last(meta)
    assert "Rahul Sharma" in _body(m) and "919811177777" in _body(m) and "I want pricing" in _body(m)
    assert [b["reply"]["id"] for b in m["interactive"]["action"]["buttons"]] == [f"ta:done:{task['id']}", f"ta:later:{task['id']}", f"ta:note:{task['id']}"]

    await wsa.inbound("", from_=REP, msg_type="interactive", extra=_tap("button_reply", f"ta:note:{task['id']}"))
    assert "Type your note" in _body(_last(meta))
    await wsa.inbound("Interested, wants a demo on Friday", from_=REP)
    assert "Note saved" in _body(_last(meta))

    await wsa.inbound("", from_=REP, msg_type="interactive", extra=_tap("button_reply", f"ta:done:{task['id']}"))
    assert "Marked done" in _body(_last(meta)) and "0 tasks left" in _body(_last(meta))
    done = (await wsa.get("/team-hub/tasks", params={"status": "done"})).json()["items"]
    assert done[0]["id"] == task["id"] and "wants a demo" in done[0]["notes"]
    # the note also shows in the lead's chat as an internal note
    convs = (await wsa.get("/inbox/conversations")).json()["items"]
    lead_conv = next(c for c in convs if c["contact"]["phone"] == "919811177777")
    msgs = (await wsa.get(f"/inbox/conversations/{lead_conv['id']}/messages")).json()["items"]
    assert any(x.get("is_internal") and "wants a demo" in (x.get("body") or "") for x in msgs)


async def test_push_to_tomorrow_and_create_task_by_text(wsa, meta):
    await _register_rep(wsa)
    await wsa.inbound("task call Priya tomorrow", from_=REP)
    assert "Task added" in _body(_last(meta)) and "Tomorrow" in _body(_last(meta))
    items = (await wsa.get("/team-hub/tasks")).json()["items"]
    assert items[0]["title"] == "call Priya tomorrow" and items[0]["source"] == "whatsapp"
    await wsa.inbound("today", from_=REP)
    assert "No tasks left for today" in _body(_last(meta))


async def test_hot_leads_and_deals(wsa, meta):
    me = await _register_rep(wsa)
    await wsa.inbound("price?", from_="919811188888", name="Hot Lead")
    contact = next(c for c in (await wsa.get("/contacts")).json()["items"] if c["phone"] == "919811188888")
    async with await db_session() as db:
        from app.models.contact import Contact
        c = await db.get(Contact, __import__("uuid").UUID(contact["id"]))
        c.lead_score, c.lead_score_reason = "hot", "Asked for price"
        await db.commit()
    r = await wsa.post("/pipeline/deals", json={"title": "Hot Lead - Growth plan", "contact_id": contact["id"], "owner_user_id": me["user_id"], "value": 129900})
    assert r.status_code == 201, r.text
    meta.sent.clear()
    await wsa.inbound("hot leads", from_=REP)
    m = _last(meta)
    assert m["interactive"]["action"]["sections"][0]["rows"][0]["title"] == "Hot Lead"
    await wsa.inbound("deals", from_=REP)
    assert "Hot Lead - Growth plan" in _body(_last(meta))
    stats = (await _me(wsa))["stats"]
    assert stats["hot_leads"] == 1 and stats["open_deals"] == 1


async def test_daily_summary_only_inside_the_window(wsa, meta):
    await _register_rep(wsa)
    await wsa.put("/team-hub/settings", json={"daily_summary": True, "summary_hour": 0})
    await wsa.inbound("hi", from_=REP)  # opens the 24h window
    meta.sent.clear()
    assert await team_hub.send_daily_summaries(__import__("app.db.session", fromlist=["x"]).async_session_factory, force=True) >= 1
    assert "Good morning" in _body(meta.sent[0])
    meta.sent.clear()
    await team_hub.send_daily_summaries(__import__("app.db.session", fromlist=["x"]).async_session_factory, force=True)
    assert not meta.sent  # once a day
