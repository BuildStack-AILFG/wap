"""Template lifecycle (build -> Meta -> status) and real broadcast sending with delivery tracking."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.services import broadcasts as bsvc
from tests.conftest import approved_template, db_session, wamid_for


async def _sync(ws, meta, *templates):
    meta.templates.extend(templates)
    r = await ws.post(f"/whatsapp/accounts/{ws.account['id']}/sync-templates")
    assert r.status_code == 200, r.text
    return r.json()


async def _contacts(ws, n, prefix="9198000000"):
    for i in range(n):
        r = await ws.post("/contacts", json={"name": f"Person {i}", "phone": f"{prefix}{i:02d}", "tags": ["vip"] if i % 2 == 0 else []})
        assert r.status_code == 201, r.text


async def _wait_done(ws, bid, timeout=10):
    await bsvc.drain()
    for _ in range(int(timeout / 0.1)):
        b = (await ws.get(f"/broadcasts/{bid}")).json()
        if b["status"] not in {"sending", "draft"}:
            return b
        await asyncio.sleep(0.1)
    raise AssertionError(f"broadcast still {b['status']}")


# ---- templates -------------------------------------------------------------------------------------------------------------------

async def test_template_validation_matches_meta_rules(wsa):
    base = {"name": "welcome_msg", "category": "MARKETING", "body": "Hi {{1}}, welcome!", "body_examples": ["Asha"], "submit": False}
    bad = [
        ({"name": "Has Spaces"}, "lowercase"),
        ({"body": "{{1}} is here", "body_examples": ["x"]}, "start or end"),
        ({"body": "Hi {{2}} there", "body_examples": ["x"]}, "sequential"),
        ({"body_examples": []}, "sample value"),
        ({"header_type": "image"}, "sample image URL"),
        ({"buttons": [{"type": "url", "text": "Go", "url": "ftp://x"}]}, "http"),
        ({"footer": "x" * 61}, None),  # rejected by the schema itself
    ]
    for patch, needle in bad:
        r = await wsa.post("/templates", json={**base, **patch})
        assert r.status_code == 422, (patch, r.text)
        if needle:
            assert needle in str(r.json()).lower() or needle in r.text, (patch, r.text)
    assert (await wsa.post("/templates", json=base)).status_code == 201


async def test_create_submit_then_status_webhook_approves(wsa, meta):
    r = await wsa.post("/templates", json={"name": "order_update", "category": "UTILITY", "body": "Hi {{1}}, order {{2}} shipped!", "body_examples": ["Asha", "A12"],
                                           "footer": "Thanks", "buttons": [{"type": "quick_reply", "text": "Got it"}, {"type": "url", "text": "Track", "url": "https://x.co/t/{{1}}", "example": "https://x.co/t/A12"}]})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["status"] == "pending" and t["meta_template_id"]

    created = next(c for c in meta.calls if c["method"] == "POST" and c["path"].endswith("/message_templates"))["body"]
    kinds = [c["type"] for c in created["components"]]
    assert kinds == ["BODY", "FOOTER", "BUTTONS"] and created["components"][0]["example"]["body_text"] == [["Asha", "A12"]]
    assert created["components"][2]["buttons"][1]["example"] == ["https://x.co/t/A12"]

    # Meta approves it -> webhook -> status flips, and duplicate deliveries are harmless
    payload = {"object": "whatsapp_business_account", "entry": [{"id": wsa.account["waba_id"], "changes": [{"field": "message_template_status_update",
               "value": {"event": "APPROVED", "message_template_id": t["meta_template_id"], "message_template_name": "order_update", "message_template_language": "en"}}]}]}
    assert (await wsa.webhook(payload)).status_code == 200
    assert (await wsa.webhook(payload)).status_code == 200
    got = (await wsa.get(f"/templates/{t['id']}")).json()
    assert got["status"] == "approved"

    rej = {**payload, "entry": [{**payload["entry"][0], "changes": [{"field": "message_template_status_update", "value": {
        "event": "REJECTED", "reason": "INVALID_FORMAT", "message_template_id": t["meta_template_id"], "message_template_name": "order_update", "message_template_language": "en"}}]}]}
    await wsa.webhook(rej)
    got = (await wsa.get(f"/templates/{t['id']}")).json()
    assert got["status"] == "rejected" and got["rejection_reason"] == "INVALID_FORMAT"


async def test_meta_rejection_at_submit_keeps_a_draft(wsa, meta):
    import httpx
    meta.override = lambda req: (httpx.Response(400, json={"error": {"message": "Invalid parameter", "code": 100, "error_user_msg": "Template name already exists in this language"}})
                                 if req.method == "POST" and req.url.path.endswith("/message_templates") else None)
    r = await wsa.post("/templates", json={"name": "dup_tpl", "category": "UTILITY", "body": "Hello there friend"})
    assert r.status_code == 201 and r.json()["status"] == "draft" and "already exists" in r.json()["submit_error"]


async def test_sync_pulls_templates_created_in_meta_and_parses_components(wsa, meta):
    tpl = {"id": "m1", "name": "carousel_promo", "language": "en_US", "status": "APPROVED", "category": "MARKETING", "quality_score": {"score": "GREEN"}, "components": [
        {"type": "HEADER", "format": "IMAGE", "example": {"header_handle": ["h:abc"]}}, {"type": "BODY", "text": "Sale {{1}}!", "example": {"body_text": [["50%"]]}},
        {"type": "FOOTER", "text": "T&C"}, {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Yes"}, {"type": "PHONE_NUMBER", "text": "Call", "phone_number": "+911234567890"}]}]}
    res = await _sync(wsa, meta, tpl, approved_template("promo_offer"))
    assert res == {"created": 2, "updated": 0, "total": 2}
    t = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "carousel_promo")
    assert (t["header_type"], t["footer"], t["status"], t["language"], t["quality_score"]) == ("image", "T&C", "approved", "en_US", "GREEN")
    assert [b["type"] for b in t["buttons"]] == ["quick_reply", "phone"] and t["requires"]["header_media"] == "image" and t["requires"]["body"] == [1]
    meta.templates.clear()
    assert (await _sync(wsa, meta, tpl))["updated"] == 1  # second sync updates instead of duplicating


async def test_delete_template_removes_it_on_meta_too(wsa, meta):
    await _sync(wsa, meta, approved_template("bye_tpl"))
    t = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "bye_tpl")
    assert (await wsa.delete(f"/templates/{t['id']}")).status_code == 204
    assert any(c["method"] == "DELETE" and c["params"].get("name") == "bye_tpl" for c in meta.calls)
    assert all(x["name"] != "bye_tpl" for x in (await wsa.get("/templates")).json())


async def test_authentication_template_uses_metas_fixed_layout(wsa, meta):
    r = await wsa.post("/templates", json={"name": "login_code", "category": "AUTHENTICATION", "body": ""})
    assert r.status_code == 201, r.text
    comps = next(c for c in meta.calls if c["method"] == "POST" and c["path"].endswith("/message_templates"))["body"]["components"]
    assert comps[0] == {"type": "BODY", "add_security_recommendation": True} and comps[2]["buttons"][0]["type"] == "OTP"


# ---- broadcasts --------------------------------------------------------------------------------------------------------------------

async def test_broadcast_sends_real_messages_with_mapped_variables(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 4)
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    r = await wsa.post("/broadcasts", json={"name": "Diwali", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "send_now": True,
                                            "variable_mapping": {"body": {"1": {"source": "first_name"}, "2": {"source": "fixed", "value": "20%"}}}})
    assert r.status_code == 201, r.text
    b = await _wait_done(wsa, r.json()["id"])
    assert b["status"] == "completed" and b["sent"] == 4 and b["total_recipients"] == 4 and b["failed"] == 0

    assert len(meta.sent) == 4
    first = next(m for m in meta.sent if m["to"] == "919800000000")
    body = first["template"]["components"][0]["parameters"]
    assert first["template"]["name"] == "promo_offer" and body == [{"type": "text", "text": "Person"}, {"type": "text", "text": "20%"}]

    # delivery receipts drive the funnel; replies are attributed to the campaign
    recs = (await wsa.get(f"/broadcasts/{b['id']}/recipients")).json()["items"]
    assert len(recs) == 4 and all(x["status"] == "sent" for x in recs)
    await wsa.status(wamid_for(meta, "919800000000"), "delivered", recipient="919800000000")
    await wsa.status(wamid_for(meta, "919800000000"), "read", recipient="919800000000")
    await wsa.status(wamid_for(meta, "919800000001"), "delivered", recipient="919800000001")
    await wsa.status(wamid_for(meta, "919800000002"), "failed", recipient="919800000002", errors=[{"code": 131026, "title": "Message undeliverable"}])
    await wsa.inbound("Yes please", from_="919800000000", wamid="wamid.REPLY1")
    b = (await wsa.get(f"/broadcasts/{b['id']}")).json()
    assert (b["delivered"], b["read"], b["failed"], b["replied"]) == (2, 1, 1, 1)
    assert b["read_pct"] == 25.0
    failed = (await wsa.get(f"/broadcasts/{b['id']}/recipients", params={"status": "failed"})).json()["items"]
    assert len(failed) == 1 and "undeliverable" in failed[0]["error"].lower()


async def test_broadcast_skips_opted_out_and_supports_tag_and_segment_audiences(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 6)
    contacts = (await wsa.get("/contacts", params={"limit": 200})).json()["items"]
    await wsa.patch(f"/contacts/{contacts[0]['id']}", json={"opted_out": True})
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    mapping = {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "5%"}}}

    prev = await wsa.post("/broadcasts/preview-audience", json={"type": "tag", "tag": "vip"})
    assert prev.json()["count"] in (2, 3) and prev.json()["skipped"] in (0, 1)

    seg = (await wsa.post("/segments", json={"name": "VIPs", "filters": {"match": "all", "rules": [{"field": "tag", "op": "has", "value": "vip"}, {"field": "opted_out", "op": "is_false"}]}})).json()
    assert seg["count"] == prev.json()["count"]
    r = await wsa.post("/broadcasts", json={"name": "VIP only", "template_id": tpl["id"], "audience": {"type": "segment", "segment_id": seg["id"]}, "variable_mapping": mapping, "send_now": True})
    b = await _wait_done(wsa, r.json()["id"])
    assert b["sent"] == seg["count"]
    assert all(m["to"] != contacts[0]["phone"] for m in meta.sent)  # the opted-out contact never got a message


async def test_broadcast_csv_audience_creates_contacts_and_uses_csv_columns(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    rows = [{"phone": "+91 98111 00001", "name": "Ravi", "offer": "15%"}, {"phone": "not-a-phone", "name": "Bad"}, {"phone": "919811100002", "name": "Sita", "offer": "25%"}]
    r = await wsa.post("/broadcasts", json={"name": "CSV run", "template_id": tpl["id"], "audience": {"type": "csv", "rows": rows}, "send_now": True,
                                            "variable_mapping": {"body": {"1": {"source": "name"}, "2": {"source": "csv:offer"}}}})
    assert r.status_code == 201 and r.json()["skipped"] == 1, r.text
    b = await _wait_done(wsa, r.json()["id"])
    assert b["sent"] == 2
    ravi = next(m for m in meta.sent if m["to"] == "919811100001")
    assert ravi["template"]["components"][0]["parameters"][1]["text"] == "15%"
    assert (await wsa.get("/contacts", params={"q": "Ravi"})).json()["total"] == 1


async def test_broadcast_preconditions(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"), {**approved_template("pending_tpl"), "status": "PENDING"})
    await _contacts(wsa, 1)
    tpls = {t["name"]: t for t in (await wsa.get("/templates")).json()}
    mapping = {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "x"}}}
    r = await wsa.post("/broadcasts", json={"name": "n", "template_id": tpls["pending_tpl"]["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping})
    assert r.status_code == 409 and "approved" in r.json()["detail"]["error"]
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = await wsa.post("/broadcasts", json={"name": "n", "template_id": tpls["promo_offer"]["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping, "schedule_at": past})
    assert r.status_code == 422
    r = await wsa.post("/broadcasts", json={"name": "n", "template_id": tpls["promo_offer"]["id"], "audience": {"type": "tag", "tag": "nobody"}, "variable_mapping": mapping})
    assert r.status_code == 422 and "no contacts" in r.json()["detail"]["error"].lower()


async def test_scheduled_broadcast_is_picked_up_by_the_scheduler_and_can_be_cancelled(wsa, meta):
    from app.services import scheduler
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 2)
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    mapping = {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "x"}}}
    when = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    later = (await wsa.post("/broadcasts", json={"name": "later", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping, "schedule_at": when})).json()
    soon = (await wsa.post("/broadcasts", json={"name": "soon", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping, "schedule_at": when})).json()
    assert later["status"] == "scheduled"

    await scheduler.tick()
    assert not meta.sent  # not due yet
    from app.models.broadcast import Broadcast
    async with await db_session() as db:
        await db.execute(update(Broadcast).where(Broadcast.id == soon["id"]).values(scheduled_at=datetime.now(timezone.utc) - timedelta(seconds=5)))
        await db.commit()
    await wsa.post(f"/broadcasts/{later['id']}/cancel")
    await scheduler.tick()
    b = await _wait_done(wsa, soon["id"])
    assert b["status"] == "completed" and b["sent"] == 2
    assert (await wsa.get(f"/broadcasts/{later['id']}")).json()["status"] == "cancelled"
    assert len(meta.sent) == 2


async def test_rate_limit_pauses_and_resumes_without_resending(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 3)
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    mapping = {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "x"}}}
    r = await wsa.post("/broadcasts", json={"name": "rl", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping})
    bid = r.json()["id"]
    meta.fail_queue.append((429, {"error": {"message": "Too many messages", "code": 130429}}))
    meta.fail_queue.append((429, {"error": {"message": "Too many messages", "code": 130429}}))
    await wsa.post(f"/broadcasts/{bid}/start")
    await bsvc.drain()
    b = (await wsa.get(f"/broadcasts/{bid}")).json()
    assert b["status"] == "scheduled" and "rate limit" in b["error"].lower() and b["sent"] == 0

    from app.models.broadcast import Broadcast
    from app.services import scheduler
    async with await db_session() as db:
        await db.execute(update(Broadcast).where(Broadcast.id == bid).values(scheduled_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        await db.commit()
    meta.fail_queue.clear()
    await scheduler.tick()
    b = await _wait_done(wsa, bid)
    assert b["status"] == "completed" and b["sent"] == 3
    assert len({m["to"] for m in meta.sent}) == 3  # each recipient exactly once


async def test_retry_failed_recipients(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 2)
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    mapping = {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "x"}}}
    meta.fail_next(400, 131026, "Message undeliverable")
    r = await wsa.post("/broadcasts", json={"name": "retry", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "variable_mapping": mapping, "send_now": True})
    b = await _wait_done(wsa, r.json()["id"])
    assert b["failed"] == 1 and b["sent"] == 1
    rr = await wsa.post(f"/broadcasts/{b['id']}/retry-failed")
    assert rr.json()["retrying"] == 1
    b = await _wait_done(wsa, b["id"])
    assert b["failed"] == 0 and b["sent"] == 2


async def test_auth_failure_stops_broadcast_and_flags_the_number(wsa, meta):
    await _sync(wsa, meta, approved_template("promo_offer"))
    await _contacts(wsa, 2)
    tpl = next(x for x in (await wsa.get("/templates")).json() if x["name"] == "promo_offer")
    meta.fail_next(401, 190, "Error validating access token")
    r = await wsa.post("/broadcasts", json={"name": "auth", "template_id": tpl["id"], "audience": {"type": "all_contacts"}, "send_now": True,
                                            "variable_mapping": {"body": {"1": {"source": "name"}, "2": {"source": "fixed", "value": "x"}}}})
    b = await _wait_done(wsa, r.json()["id"])
    assert b["status"] == "failed" and "token" in b["error"].lower()
    acct = (await wsa.get("/whatsapp/accounts")).json()[0]
    assert acct["status"] == "error"
    notes = (await wsa.get("/notifications")).json()["items"]
    assert any("needs attention" in n["title"].lower() for n in notes)
