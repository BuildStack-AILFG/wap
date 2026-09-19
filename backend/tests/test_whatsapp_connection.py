"""Connecting a number, receiving webhooks, and the shared inbox — the Phase 0/1 contract from lib/PHASES.md."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from tests.conftest import APP_SECRET, db_session, sign


async def test_connect_validates_credentials_and_hides_secrets(ws, meta):
    bad = await ws.post("/whatsapp/accounts", json={"waba_id": "12345678", "phone_number_id": "87654321", "access_token": "bad-token-" + "y" * 20, "app_secret": APP_SECRET})
    assert bad.status_code == 400 and "rejected" in bad.json()["detail"]["error"].lower()

    acct = await ws.connect(meta)
    assert acct["status"] == "connected" and acct["quality_rating"] == "GREEN" and acct["verified_name"] == "Acme"
    assert acct["webhook_url"].startswith("https://api.test/api/webhooks/whatsapp/")
    assert "access_token" not in json.dumps(acct)  # credentials are never echoed back

    # the token is stored encrypted, not in clear text
    from app.models.whatsapp_account import WhatsAppAccount
    async with await db_session() as db:
        row = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.id == acct["id"]))).scalar_one()
        assert "good-token" not in row.access_token_enc

    # Meta was asked to subscribe the app and point its webhook at our per-account URL
    sub = next(c for c in meta.calls if c["path"].endswith("/subscribed_apps"))
    assert sub["path"].endswith(f"{acct['waba_id']}/subscribed_apps")


async def test_duplicate_number_rejected_across_workspaces(ws, other, meta):
    a = await ws.connect(meta)
    r = await other.post("/whatsapp/accounts", json={"waba_id": a["waba_id"], "phone_number_id": a["phone_number_id"], "access_token": meta.token, "app_secret": APP_SECRET})
    assert r.status_code == 409


async def test_webhook_verification_handshake(wsa):
    key = wsa.account["webhook_url"].rsplit("/", 1)[1]
    ok = await wsa.client.get(f"/api/webhooks/whatsapp/{key}", params={"hub.mode": "subscribe", "hub.verify_token": wsa.account["verify_token"], "hub.challenge": "12345"})
    assert ok.status_code == 200 and ok.text == "12345"
    bad = await wsa.client.get(f"/api/webhooks/whatsapp/{key}", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1"})
    assert bad.status_code == 403
    plat = await wsa.client.get("/api/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "platform-verify", "hub.challenge": "777"})
    assert plat.text == "777"


async def test_inbound_requires_valid_signature(wsa):
    key = wsa.account["webhook_url"].rsplit("/", 1)[1]
    raw = json.dumps({"object": "whatsapp_business_account", "entry": []}).encode()
    for hdr in ({}, {"x-hub-signature-256": "sha256=deadbeef"}, {"x-hub-signature-256": sign(raw, "wrong-secret")}):
        r = await wsa.client.post(f"/api/webhooks/whatsapp/{key}", content=raw, headers={"content-type": "application/json", **hdr})
        assert r.status_code == 401
    good = await wsa.client.post(f"/api/webhooks/whatsapp/{key}", content=raw, headers={"content-type": "application/json", "x-hub-signature-256": sign(raw)})
    assert good.status_code == 200


async def test_inbound_message_creates_contact_conversation_and_is_idempotent(wsa):
    r = await wsa.inbound("Hello, do you deliver?", wamid="wamid.DUP1", name="Asha Rao")
    assert r.status_code == 200 and r.json()["messages"] == 1
    again = await wsa.inbound("Hello, do you deliver?", wamid="wamid.DUP1", name="Asha Rao")  # Meta retries deliveries
    assert again.json()["duplicates"] == 1 and again.json()["messages"] == 0

    convs = (await wsa.get("/inbox/conversations")).json()
    assert convs["total"] == 1
    c = convs["items"][0]
    assert c["contact"]["name"] == "Asha Rao" and c["contact"]["phone"] == "919811112222"
    assert c["unread_count"] == 1 and c["window_open"] is True and c["last_message_preview"] == "Hello, do you deliver?"

    msgs = (await wsa.get(f"/inbox/conversations/{c['id']}/messages")).json()["items"]
    assert [m["body"] for m in msgs] == ["Hello, do you deliver?"] and msgs[0]["direction"] == "in"
    contacts = (await wsa.get("/contacts")).json()
    assert contacts["total"] == 1 and contacts["items"][0]["source"] == "whatsapp"


async def test_webhook_for_a_different_number_is_ignored(wsa, other, meta):
    """A signed payload naming another tenant's phone_number_id must not create data in this workspace."""
    await other.connect(meta)
    raw = json.dumps({"object": "whatsapp_business_account", "entry": [{"id": other.account["waba_id"], "changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": other.phone_number_id}, "contacts": [{"profile": {"name": "X"}, "wa_id": "911"}],
        "messages": [{"from": "919000000001", "id": "wamid.SPOOF", "timestamp": "1700000000", "type": "text", "text": {"body": "spoof"}}]}}]}]}).encode()
    key = wsa.account["webhook_url"].rsplit("/", 1)[1]
    r = await wsa.client.post(f"/api/webhooks/whatsapp/{key}", content=raw, headers={"content-type": "application/json", "x-hub-signature-256": sign(raw)})
    assert r.status_code == 200 and r.json()["messages"] == 0
    assert (await other.get("/contacts")).json()["total"] == 0 and (await wsa.get("/contacts")).json()["total"] == 0


async def test_send_reply_and_delivery_ticks(wsa, meta):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    r = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "text", "text": "Hello Asha!"})
    assert r.status_code == 201, r.text
    msg = r.json()
    assert msg["status"] == "sent" and msg["direction"] == "out"
    sent = meta.sent[-1]
    assert sent["to"] == "919811112222" and sent["type"] == "text" and sent["text"]["body"] == "Hello Asha!"

    wamid = meta.sent[-1]["_wamid"]
    await wsa.status(wamid, "delivered")
    await wsa.status(wamid, "read")
    await wsa.status(wamid, "sent")  # out-of-order/late 'sent' must not downgrade a read message
    msgs = (await wsa.get(f"/inbox/conversations/{conv['id']}/messages")).json()["items"]
    out = next(m for m in msgs if m["direction"] == "out")
    assert out["status"] == "read" and out["read_at"] and out["delivered_at"]

    # a human replied -> the bot is paused for this conversation, and the reply cleared the unread badge
    detail = (await wsa.get(f"/inbox/conversations/{conv['id']}")).json()
    assert detail["inbox_status"] == "intervened" and detail["unread_count"] == 0 and detail["assigned_user"]["id"] == wsa.user_id


async def test_24h_window_blocks_free_text_but_allows_templates(wsa, meta):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    from app.models.conversation import Conversation
    async with await db_session() as db:
        await db.execute(update(Conversation).where(Conversation.id == conv["id"]).values(last_inbound_at=datetime.now(timezone.utc) - timedelta(hours=25)))
        await db.commit()
    blocked = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "text", "text": "too late"})
    assert blocked.status_code == 409 and blocked.json()["detail"]["code"] == "outside_window"
    assert not meta.sent  # never reached Meta

    meta.templates.append({"id": "t1", "name": "followup", "language": "en", "status": "APPROVED", "category": "UTILITY", "components": [{"type": "BODY", "text": "Following up on your request."}]})
    await wsa.post(f"/whatsapp/accounts/{wsa.account['id']}/sync-templates")
    tpl = next(t for t in (await wsa.get("/templates")).json() if t["name"] == "followup")
    ok = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "template", "template_id": tpl["id"]})
    assert ok.status_code == 201, ok.text
    assert meta.sent[-1]["type"] == "template" and meta.sent[-1]["template"]["name"] == "followup"


async def test_meta_error_is_recorded_and_surfaced(wsa, meta):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    meta.fail_next(400, 131047, "Re-engagement message")
    r = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "text", "text": "hello"})
    assert r.status_code == 502 and "Re-engagement" in r.json()["detail"]["error"]
    msgs = (await wsa.get(f"/inbox/conversations/{conv['id']}/messages")).json()["items"]
    assert [m for m in msgs if m["direction"] == "out"][0]["status"] == "failed"


async def test_internal_notes_are_not_sent(wsa, meta):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    r = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "note", "text": "VIP customer, be nice"})
    assert r.status_code == 201 and r.json()["is_internal"] is True
    assert not meta.sent


async def test_assign_resolve_label_and_reopen_on_new_message(wsa):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    r = await wsa.patch(f"/inbox/conversations/{conv['id']}", json={"status": "resolved", "labels": ["vip", "vip", " refund "], "assigned_user_id": wsa.user_id})
    assert r.status_code == 200 and r.json()["labels"] == ["refund", "vip"] and r.json()["status"] == "resolved"
    assert (await wsa.get("/inbox/conversations", params={"status": "open"})).json()["total"] == 0
    await wsa.inbound("one more thing")
    assert (await wsa.get("/inbox/conversations", params={"status": "open", "assigned": "me"})).json()["total"] == 1
    s = (await wsa.get("/inbox/summary")).json()
    assert s["open"] == 1 and s["mine"] == 1 and "vip" in s["labels"]


async def test_opt_out_keyword_blocks_marketing_and_start_resubscribes(wsa):
    await wsa.inbound("STOP")
    contact = (await wsa.get("/contacts")).json()["items"][0]
    assert contact["opted_out"] is True
    await wsa.inbound("start", wamid="wamid.START1")
    assert (await wsa.get("/contacts")).json()["items"][0]["opted_out"] is False


async def test_media_upload_send_and_download(wsa, meta):
    await wsa.inbound("Hi")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    up = await wsa.post(f"/inbox/conversations/{conv['id']}/media", files={"file": ("pic.png", b"\x89PNG....", "image/png")})
    assert up.status_code == 200 and up.json()["type"] == "image"
    bad = await wsa.post(f"/inbox/conversations/{conv['id']}/media", files={"file": ("run.exe", b"MZ", "application/x-msdownload")})
    assert bad.status_code == 415
    sent = await wsa.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "image", "media_id": up.json()["media_id"], "text": "Our menu"})
    assert sent.status_code == 201 and meta.sent[-1]["image"] == {"id": up.json()["media_id"], "caption": "Our menu"}

    await wsa.inbound("", wamid="wamid.IMG1", msg_type="image", extra={"image": {"id": "media77", "mime_type": "image/png", "caption": "receipt"}})
    msgs = (await wsa.get(f"/inbox/conversations/{conv['id']}/messages")).json()["items"]
    img = next(m for m in msgs if m["type"] == "image" and m["direction"] == "in")
    dl = await wsa.get(f"/inbox/messages/{img['id']}/media")
    assert dl.status_code == 200 and dl.headers["content-type"] == "image/png" and dl.content.startswith(b"\x89PNG")


async def test_tenant_isolation(wsa, other):
    await wsa.inbound("secret")
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]
    assert (await other.get(f"/inbox/conversations/{conv['id']}")).status_code == 404
    assert (await other.get(f"/inbox/conversations/{conv['id']}/messages")).status_code == 404
    assert (await other.post(f"/inbox/conversations/{conv['id']}/messages", json={"type": "note", "text": "x"})).status_code == 404
    assert (await other.get("/inbox/conversations")).json()["total"] == 0
    assert (await other.get(f"/whatsapp/accounts")).json() == []
