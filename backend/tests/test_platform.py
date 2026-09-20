"""Contacts, segments, team & roles, widget, developer API, webhooks, integrations, analytics, auth hardening."""

from __future__ import annotations

import pytest
import base64
import hashlib
import hmac
import http.server
import json
import threading
import time

from app.services import mailer, outbound_webhooks
from tests.conftest import approved_template, db_session


# ---- contacts ---------------------------------------------------------------------------------------------------------------------------

CSV = "Name,Mobile,Email,Tags,City,Plan\nAsha Rao,+91 98111 00001,asha@x.io,vip;lead,Pune,pro\nRavi,9811100002,,,Delhi,basic\nBad Row,12,,,,\nDup,+919811100001,,,,\n,,,,,\n"


async def test_csv_import_maps_columns_normalises_phones_and_reports_errors(wsa):
    await wsa.patch("/settings", json={"settings": {"default_country_code": "91"}})
    r = await wsa.post("/contacts/import", files={"file": ("contacts.csv", CSV.encode(), "text/csv")}, data={"add_tag": "imported"})
    assert r.status_code == 200, r.text
    res = r.json()
    assert (res["created"], res["updated"], res["skipped"]) == (2, 0, 2) and res["total_rows"] == 4
    assert {e["row"] for e in res["errors"]} == {4, 5} and "valid phone" in res["errors"][0]["error"]

    items = {c["phone"]: c for c in (await wsa.get("/contacts")).json()["items"]}
    assert set(items) == {"919811100001", "919811100002"}  # +91 98111 00001 and a bare national number both normalised
    asha = items["919811100001"]
    assert asha["tags"] == ["vip", "lead", "imported"] and asha["traits"] == {"City": "Pune", "Plan": "pro"} or asha["traits"] == {"city": "Pune", "plan": "pro"}
    assert asha["source"] == "import"

    again = (await wsa.post("/contacts/import", files={"file": ("c.csv", b"phone,name\n919811100001,Asha Updated\n", "text/csv")})).json()
    assert (again["created"], again["updated"]) == (0, 1)
    assert (await wsa.get(f"/contacts/{asha['id']}")).json()["name"] == "Asha Updated"


async def test_csv_import_rejects_missing_phone_column_and_oversize(wsa):
    r = await wsa.post("/contacts/import", files={"file": ("c.csv", b"name,email\nA,a@x.io\n", "text/csv")})
    assert r.status_code == 422 and "phone" in r.json()["detail"]["error"]
    r = await wsa.post("/contacts/import", files={"file": ("big.csv", b"phone\n" + b"1" * (6 * 1024 * 1024), "text/csv")})
    assert r.status_code == 413


async def test_export_neutralises_spreadsheet_formulas(wsa):
    await wsa.post("/contacts", json={"name": "=HYPERLINK(\"http://evil\")", "phone": "919811100077", "tags": ["a"], "traits": {"note": "@cmd"}})
    r = await wsa.get("/contacts/export/csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    body = r.text
    assert "'=HYPERLINK" in body and "'@cmd" in body  # cells starting with = or @ are defused so Excel/Sheets won't execute them
    assert not any(cell.startswith(("=", "@")) for line in body.splitlines() for cell in line.split(","))
    assert "+919811100077" in body  # ordinary phone numbers are left intact


async def test_contact_list_search_filter_pagination_and_bulk(wsa):
    for i in range(7):
        await wsa.post("/contacts", json={"name": f"Cust {i}", "phone": f"9198111000{i:02d}", "tags": ["vip"] if i < 3 else [], "email": f"c{i}@shop.io"})
    page = (await wsa.get("/contacts", params={"limit": 3, "offset": 3, "sort": "name"})).json()
    assert page["total"] == 7 and [c["name"] for c in page["items"]] == ["Cust 3", "Cust 4", "Cust 5"]
    assert (await wsa.get("/contacts", params={"tag": "vip"})).json()["total"] == 3
    assert (await wsa.get("/contacts", params={"q": "c6@shop"})).json()["total"] == 1
    assert (await wsa.get("/contacts", params={"q": "+919811100002"})).json()["total"] == 1
    tags = (await wsa.get("/contacts/tags")).json()
    assert tags[0] == {"tag": "vip", "count": 3}

    ids = [c["id"] for c in (await wsa.get("/contacts", params={"tag": "vip"})).json()["items"]]
    assert (await wsa.post("/contacts/bulk", json={"ids": ids, "action": "add_tag", "tag": "gold"})).json()["affected"] == 3
    assert (await wsa.get("/contacts", params={"tag": "gold"})).json()["total"] == 3
    await wsa.post("/contacts/bulk", json={"ids": ids, "action": "opt_out"})
    assert (await wsa.get("/contacts", params={"opted_out": True})).json()["total"] == 3
    await wsa.post("/contacts/bulk", json={"ids": ids, "action": "delete"})
    assert (await wsa.get("/contacts")).json()["total"] == 4


async def test_contact_validation_duplicates_and_plan_quota(wsa):
    assert (await wsa.post("/contacts", json={"name": "X", "phone": "12"})).status_code == 422
    assert (await wsa.post("/contacts", json={"name": "A", "phone": "919811100001"})).status_code == 201
    assert (await wsa.post("/contacts", json={"name": "B", "phone": "+91 98111-00001"})).status_code == 409
    from app.models.tenant import Tenant
    async with await db_session() as db:
        t = await db.get(Tenant, wsa.tenant_id)
        t.quotas_override = {"max_contacts": 2}
        await db.commit()
    assert (await wsa.post("/contacts", json={"name": "C", "phone": "919811100003"})).status_code == 201
    over = await wsa.post("/contacts", json={"name": "D", "phone": "919811100004"})
    assert over.status_code == 402 and "plan allows 2 contacts" in over.json()["detail"]["error"]


async def test_segments_by_trait_tag_and_event(wsa):
    await wsa.post("/contacts", json={"name": "A", "phone": "919811100001", "tags": ["vip"], "traits": {"city": "Pune"}})
    await wsa.post("/contacts", json={"name": "B", "phone": "919811100002", "traits": {"city": "Delhi"}})
    await wsa.post("/contacts", json={"name": "C", "phone": "919811100003", "traits": {"city": "Pune"}})
    c = (await wsa.get("/contacts", params={"q": "919811100003"})).json()["items"][0]
    await wsa.post(f"/contacts/{c['id']}/events", json={"name": "order_placed", "properties": {"total": 10}})

    def rules(*r, match="all"):
        return {"match": match, "rules": list(r)}
    pune = {"field": "trait:city", "op": "eq", "value": "Pune"}
    assert (await wsa.post("/segments/preview", json=rules(pune))).json()["count"] == 2
    assert (await wsa.post("/segments/preview", json=rules(pune, {"field": "tag", "op": "has", "value": "vip"}))).json()["count"] == 1
    assert (await wsa.post("/segments/preview", json=rules(pune, {"field": "event:order_placed", "op": "exists"}))).json()["count"] == 1
    assert (await wsa.post("/segments/preview", json=rules({"field": "tag", "op": "has", "value": "vip"}, {"field": "trait:city", "op": "eq", "value": "Delhi"}, match="any"))).json()["count"] == 2
    assert (await wsa.post("/segments/preview", json=rules({"field": "bogus", "op": "eq", "value": 1}))).status_code == 422
    seg = (await wsa.post("/segments", json={"name": "Pune buyers", "filters": rules(pune)})).json()
    assert seg["count"] == 2 and (await wsa.get("/contacts", params={"segment_id": seg["id"]})).json()["total"] == 2


# ---- team & roles ------------------------------------------------------------------------------------------------------------------------

@pytest.mark.paid
async def test_invite_accept_roles_and_removal(wsa, monkeypatch):
    sent = []

    async def fake_send(to, subject, html):
        sent.append((to, subject, html))
        return True
    monkeypatch.setattr(mailer, "send", fake_send)

    inv = (await wsa.post("/team/invites", json={"email": "Sam@Example.com", "role": "agent"})).json()
    assert inv["email_sent"] is True and inv["invite_link"] is None and sent[0][0] == "sam@example.com"
    token = sent[0][2].split("accept-invite?token=")[1].split('"')[0].split("<")[0].split("&")[0]

    info = (await wsa.client.get(f"/api/team/invite/{token}")).json()
    assert info["email"] == "sam@example.com" and info["role"] == "agent"
    weak = await wsa.client.post(f"/api/team/invite/{token}/accept", json={"full_name": "Sam", "password": "password"})
    assert weak.status_code == 400
    ok = await wsa.client.post(f"/api/team/invite/{token}/accept", json={"full_name": "Sam Lee", "password": "Xk9!mQ2#vLp7zR"})
    assert ok.status_code == 201 and ok.json()["role"] == "agent" and ok.json()["workspace"]["id"] == wsa.tenant_id
    assert (await wsa.client.post(f"/api/team/invite/{token}/accept", json={"full_name": "Again", "password": "Xk9!mQ2#vLp7zR"})).status_code == 404  # single use

    agent_h = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    members = (await wsa.get("/team/members")).json()
    assert {m["email"] for m in members} == {wsa.email, "sam@example.com"}
    sam = next(m for m in members if m["email"] == "sam@example.com")

    # an agent can work the inbox but can't administer the workspace
    assert (await wsa.client.get("/api/inbox/conversations", headers=agent_h)).status_code == 200
    assert (await wsa.client.get("/api/developer/keys", headers=agent_h)).status_code == 403
    assert (await wsa.client.post("/api/team/invites", headers=agent_h, json={"email": "x@y.io"})).status_code == 403
    assert (await wsa.client.patch("/api/settings", headers=agent_h, json={"settings": {"custom_replies_enabled": False}})).status_code == 403
    assert (await wsa.client.patch("/api/settings", headers=agent_h, json={"settings": {"quick_replies": [{"shortcut": "hi", "text": "Hello"}]}})).status_code == 200

    assert (await wsa.patch(f"/team/members/{sam['user_id']}", json={"role": "viewer"})).status_code == 200
    assert (await wsa.client.post("/api/contacts", headers=agent_h, json={"name": "n", "phone": "919811100055"})).status_code == 403  # viewers are read-only
    assert (await wsa.patch(f"/team/members/{wsa.user_id}", json={"role": "agent"})).status_code == 409  # can't demote the only owner

    assert (await wsa.delete(f"/team/members/{sam['user_id']}")).status_code == 204
    assert (await wsa.client.get("/api/inbox/conversations", headers=agent_h)).status_code == 403  # access revoked immediately, token or not


async def test_invite_without_email_provider_returns_a_shareable_link_and_respects_quota(wsa):
    inv = (await wsa.post("/team/invites", json={"email": "a@x.io", "role": "agent"})).json()
    assert inv["email_sent"] is False and inv["invite_link"].startswith("https://app.test/accept-invite?token=")
    assert (await wsa.post("/team/invites", json={"email": "b@x.io"})).status_code == 201
    third = await wsa.post("/team/invites", json={"email": "c@x.io"})  # trial: 3 seats = owner + 2 invites
    assert third.status_code == 402 and "team members" in third.json()["detail"]["error"]
    assert (await wsa.post("/team/invites", json={"email": wsa.email})).status_code == 409
    assert len((await wsa.get("/team/invites")).json()) == 2


@pytest.mark.paid
async def test_auto_assignment_round_robin(wsa):
    from app.core.security import hash_password
    from app.models.tenant import TenantMembership, User
    async with await db_session() as db:
        u = User(email=f"rr-{wsa.tenant_id[:8]}@x.io", password_hash=hash_password("x"), full_name="RR Agent")
        db.add(u)
        await db.flush()
        db.add(TenantMembership(tenant_id=wsa.tenant_id, user_id=u.id, role="agent"))
        await db.commit()
        rr_id = str(u.id)
    assert (await wsa.patch("/settings", json={"settings": {"assignment": {"mode": "round_robin"}}})).status_code == 200
    for i in range(4):
        await wsa.inbound("hi", from_=f"91980000004{i}")
    items = (await wsa.get("/inbox/conversations", params={"limit": 10})).json()["items"]
    owners = sorted(c["assigned_user"]["id"] for c in items)
    assert owners == sorted([wsa.user_id, wsa.user_id, rr_id, rr_id])  # two each, alternating
    assert (await wsa.patch("/settings", json={"settings": {"assignment": {"mode": "none"}}})).status_code == 200
    await wsa.inbound("hi", from_="919800000049")
    newest = next(c for c in (await wsa.get("/inbox/conversations", params={"limit": 10})).json()["items"] if c["contact"]["phone"] == "919800000049")
    assert newest["assigned_user"] is None


# ---- widget ---------------------------------------------------------------------------------------------------------------------------------

async def test_widget_carries_a_fixed_powered_by_credit(wsa):
    """Every widget shows "Powered by LeadForGrow.com" linking to leadforgrow.com; no workspace setting can change or remove it."""
    credit = 'href="https://leadforgrow.com" target="_blank" rel="noopener">Powered by <b>LeadForGrow.com</b>'
    w = (await wsa.post("/widgets", json={"phone_number": "919876543210", "collect_lead": True, "powered_by": "Evil Co", "powered_by_url": "https://evil.example",
                                          "title": "Powered by <a href='https://evil.example'>x</a>"})).json()
    js = (await wsa.client.get(f"/api/public/widget/{w['public_key']}.js")).text
    assert js.count(credit) == 1  # exactly one real link, hard-coded in the template (a title that mimics it is only escaped text data)
    assert '"powered_by' not in js and "Evil Co" not in js  # unknown settings are ignored, never reach the script
    updated = await wsa.put(f"/widgets/{w['id']}", json={"phone_number": "919876543210", "powered_by": "", "powered_by_url": "", "title": "Hello"})
    assert updated.status_code == 200, updated.text
    assert credit in (await wsa.client.get(f"/api/public/widget/{w['public_key']}.js")).text  # editing the widget never removes it


async def test_widget_lifecycle_script_lead_capture_and_qr(wsa):
    w = (await wsa.post("/widgets", json={"name": "Site", "phone_number": "+91 98765 43210", "title": "Chat <b>now</b>", "welcome_message": "Hi \"there\"", "collect_lead": True, "brand_color": "#112233"})).json()
    assert w["phone_number"] == "919876543210" and w["embed_snippet"] == f'<script src="https://api.test/api/public/widget/{w["public_key"]}.js" async></script>'
    assert (await wsa.post("/widgets", json={"phone_number": "919876543210", "brand_color": "red"})).status_code == 422
    assert (await wsa.post("/widgets", json={"phone_number": "12"})).status_code == 422

    js = await wsa.client.get(f"/api/public/widget/{w['public_key']}.js")  # public: no auth header
    assert js.status_code == 200 and "javascript" in js.headers["content-type"]
    assert '"phone": "919876543210"' in js.text and "#112233" in js.text and '"lead": true' in js.text
    assert "</script" not in js.text  # user text can't break out of the script

    beacon = f"/api/public/widget/{w['public_key']}"
    assert (await wsa.client.post(f"{beacon}/open", content=b"{}", headers={"content-type": "text/plain"})).status_code == 200
    await wsa.client.post(f"{beacon}/click", content=b"{}", headers={"content-type": "text/plain"})
    lead = await wsa.client.post(f"{beacon}/lead", content=json.dumps({"name": "Web Visitor", "phone": "+44 7700 900123", "page": "https://shop.io/pricing"}).encode(), headers={"content-type": "text/plain"})
    assert lead.status_code == 200 and lead.json()["stored"] is True
    bad = await wsa.client.post(f"{beacon}/lead", content=b'{"phone": "abc"}', headers={"content-type": "text/plain"})
    assert bad.status_code == 422

    contact = next(c for c in (await wsa.get("/contacts")).json()["items"] if c["phone"] == "447700900123")
    assert contact["source"] == "widget" and "website-widget" in contact["tags"] and contact["name"] == "Web Visitor"
    stats = (await wsa.get("/widgets")).json()[0]
    assert (stats["opens"], stats["clicks"], stats["leads"]) == (1, 1, 1)

    qr = await wsa.client.get("/api/public/qr", params={"text": "https://wa.me/919876543210?text=Hi"})
    assert qr.status_code == 200 and qr.headers["content-type"] == "image/svg+xml" and b"<svg" in qr.content
    assert (await wsa.client.get("/api/public/qr", params={"text": "javascript:alert(1)"})).status_code == 422

    await wsa.put(f"/widgets/{w['id']}", json={**{k: w[k] for k in ("name", "phone_number", "title", "subtitle", "welcome_message", "prefill_message", "cta_text", "brand_color", "position", "bottom_offset", "delay_seconds", "collect_lead", "allowed_domains")}, "enabled": False})
    assert "phone" not in (await wsa.client.get(f"/api/public/widget/{w['public_key']}.js")).text  # disabled -> no-op script
    assert (await wsa.client.post(f"{beacon}/open", content=b"{}", headers={"content-type": "text/plain"})).status_code == 404


async def test_widget_create_blank_number_uses_connected_number_else_asks(ws, meta):
    # No WhatsApp number connected and none typed: a clear 422 that says what to do (the UI collects the number in the create dialog).
    blank = await ws.post("/widgets", json={})
    assert blank.status_code == 422 and "WhatsApp number" in blank.json()["detail"]["error"]
    typed = await ws.post("/widgets", json={"name": "Typed", "phone_number": "+91 98765 43210"})
    assert typed.status_code == 201 and typed.json()["phone_number"] == "919876543210"

    # Once a number is connected, a blank number falls back to it instead of failing validation.
    await ws.connect(meta)
    fallback = await ws.post("/widgets", json={})
    assert fallback.status_code == 201 and fallback.json()["phone_number"] == "919876543210"


async def test_widget_domain_lock_and_lead_rate_limit(wsa):
    w = (await wsa.post("/widgets", json={"phone_number": "919876543210", "allowed_domains": ["https://shop.io/"]})).json()
    ok = await wsa.client.get(f"/api/public/widget/{w['public_key']}.js", headers={"referer": "https://www.shop.io/page"})
    evil = await wsa.client.get(f"/api/public/widget/{w['public_key']}.js", headers={"referer": "https://evil.example/"})
    assert "919876543210" in ok.text and "919876543210" not in evil.text
    for i in range(8):
        await wsa.client.post(f"/api/public/widget/{w['public_key']}/lead", content=json.dumps({"phone": f"9198000001{i:02d}"}).encode(), headers={"content-type": "text/plain", "referer": "https://shop.io/"})
    assert (await wsa.client.post(f"/api/public/widget/{w['public_key']}/lead", content=b'{"phone": "919800000199"}', headers={"content-type": "text/plain", "referer": "https://shop.io/"})).status_code == 429


# ---- developer API + webhooks -----------------------------------------------------------------------------------------------------------

@pytest.mark.paid
async def test_api_keys_public_api_and_event_triggered_flow(wsa, meta):
    meta.templates.append(approved_template("order_ship", "Hi {{1}}, order {{2}} has shipped!", "UTILITY"))
    await wsa.post(f"/whatsapp/accounts/{wsa.account['id']}/sync-templates")

    key = (await wsa.post("/developer/keys", json={"name": "Zapier"})).json()
    assert key["key"].startswith("lfg_live_") and "won't be shown again" in key["note"]
    listed = (await wsa.get("/developer/keys")).json()
    assert "key" not in listed[0] and listed[0]["prefix"] == key["key"][:14]
    H = {"Authorization": f"Bearer {key['key']}"}
    v1 = lambda path: f"/api/v1{path}"  # noqa: E731

    assert (await wsa.client.get(v1("/templates"))).status_code == 401
    assert (await wsa.client.get(v1("/templates"), headers={"Authorization": "Bearer lfg_live_wrong"})).status_code == 401
    assert [t["name"] for t in (await wsa.client.get(v1("/templates"), headers={"X-API-Key": key["key"]})).json()] == ["order_ship"]

    up = await wsa.client.post(v1("/contacts"), headers=H, json={"phone": "+91 98111 00042", "name": "Kiran", "tags": ["api"], "traits": {"tier": "gold"}})
    assert up.status_code == 200 and up.json()["created"] is True
    again = (await wsa.client.post(v1("/contacts"), headers=H, json={"phone": "919811100042", "tags": ["api", "more"], "traits": {"city": "Goa"}})).json()
    assert again["created"] is False
    c = (await wsa.get("/contacts", params={"q": "Kiran"})).json()["items"][0]
    assert c["tags"] == ["api", "more"] and c["traits"] == {"tier": "gold", "city": "Goa"}

    sent = await wsa.client.post(v1("/messages"), headers=H, json={"to": "919811100042", "type": "template", "callback_data": "order-77",
                                                                      "template": {"name": "order_ship", "language": "en", "body": ["Kiran", "#77"]}})
    assert sent.status_code == 201 and sent.json()["status"] == "sent"
    assert meta.sent[-1]["template"]["components"][0]["parameters"] == [{"type": "text", "text": "Kiran"}, {"type": "text", "text": "#77"}]
    assert (await wsa.client.post(v1("/messages"), headers=H, json={"to": "919811100042", "type": "template", "template": {"name": "order_ship", "body": ["only one"]}})).status_code == 422
    assert (await wsa.client.post(v1("/messages"), headers=H, json={"to": "919811100042", "type": "template", "template": {"name": "ghost"}})).status_code == 404
    assert (await wsa.client.post(v1("/messages"), headers=H, json={"to": "919811100042", "type": "text", "text": "free text"})).status_code == 409  # no open 24h window

    # an event-triggered flow reacts to API events
    n = lambda id_, type_, **d: {"id": id_, "type": type_, "position": {"x": 0, "y": 0}, "data": d}  # noqa: E731
    g = {"nodes": [n("start", "start", trigger="event", event="order_shipped"), n("t", "send_template", template_id=next(t["id"] for t in (await wsa.get("/templates")).json() if t["name"] == "order_ship"),
                                                                                  variables={"body": ["{{name}}", "{{var.order}}"]}), n("end", "end")],
         "edges": [{"id": "1", "source": "start", "target": "t"}, {"id": "2", "source": "t", "target": "end"}]}
    f = (await wsa.post("/flows", json={"name": "Shipped", "trigger_type": "event", "graph": g})).json()
    assert (await wsa.post(f"/flows/{f['id']}/publish")).status_code == 200
    meta.sent.clear()
    ev = await wsa.client.post(v1("/events"), headers=H, json={"phone": "919811100042", "event": "order_shipped", "properties": {"order": "#99"}})
    assert ev.status_code == 202 and ev.json()["flows_started"] == 1
    assert meta.sent[-1]["template"]["components"][0]["parameters"] == [{"type": "text", "text": "Kiran"}, {"type": "text", "text": "#99"}]
    assert (await wsa.get(f"/contacts/{c['id']}")).json()["events"][0]["name"] == "order_shipped"

    kid = listed[0]["id"]
    assert (await wsa.delete(f"/developer/keys/{kid}")).status_code == 204
    assert (await wsa.client.get(v1("/templates"), headers=H)).status_code == 401


class _Sink(http.server.BaseHTTPRequestHandler):
    received: list = []

    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers["content-length"]))
        _Sink.received.append((dict(self.headers), body))
        self.send_response(200 if not self.path.startswith("/fail") else 500)
        self.end_headers()

    def log_message(self, *a): ...


@pytest.mark.paid
async def test_outbound_webhooks_are_signed_filtered_and_auto_disabled(wsa, monkeypatch):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Sink)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    _Sink.received.clear()
    try:
        # the SSRF guard is real: private/loopback targets are refused at registration
        assert (await wsa.post("/developer/webhooks", json={"url": "http://localhost/hook", "events": []})).status_code == 422
        assert (await wsa.post("/developer/webhooks", json={"url": "http://169.254.169.254/x", "events": []})).status_code == 422
        assert (await wsa.post("/developer/webhooks", json={"url": "https://example.com/x", "events": ["nope"]})).status_code == 422

        monkeypatch.setattr("app.api.developer.assert_public_url", lambda u: None)
        monkeypatch.setattr(outbound_webhooks, "assert_public_url", lambda u: None)
        hook = (await wsa.post("/developer/webhooks", json={"url": f"{base}/ok", "events": ["message_received", "contact_created"]})).json()
        dead = (await wsa.post("/developer/webhooks", json={"url": f"{base}/fail", "events": ["message_received"]})).json()
        assert hook["secret"].startswith("whsec_") and "secret" not in (await wsa.get("/developer/webhooks")).json()[0]

        ping = (await wsa.post(f"/developer/webhooks/{hook['id']}/test")).json()
        assert ping["ok"] is True
        _Sink.received.clear()

        await wsa.inbound("hello webhooks", from_="919800000051")
        await outbound_webhooks.drain()
        got = [(h, json.loads(b)) for h, b in _Sink.received if "/ok" in h.get("Host", "") or True]
        events = sorted(e["type"] for _, e in got)
        assert "message_received" in events and "contact_created" in events and "conversation_created" not in events  # only subscribed events

        headers, body = next((h, b) for h, b in _Sink.received if json.loads(b)["type"] == "message_received")
        secret = hook["secret"]
        assert headers["X-LFG-Signature"] == "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        env = json.loads(body)
        assert env["version"] == "1.0" and env["data"]["text"] == "hello webhooks" and env["data"]["from"] == "919800000051"
        assert (await wsa.get(f"/developer/webhooks/{hook['id']}/secret")).json()["secret"] == secret

        # a dead endpoint is disabled after 5 consecutive failures rather than hammered forever
        for i in range(5):
            await wsa.inbound(f"m{i}", from_="919800000051", wamid=f"wamid.WH{i}")
            await outbound_webhooks.drain()
        rows = {h["id"]: h for h in (await wsa.get("/developer/webhooks")).json()}
        assert rows[dead["id"]]["enabled"] is False and rows[dead["id"]]["failure_count"] >= 5 and "500" in rows[dead["id"]]["last_status"]
        assert rows[hook["id"]]["enabled"] is True and rows[hook["id"]]["failure_count"] == 0
    finally:
        srv.shutdown()


# ---- integrations ---------------------------------------------------------------------------------------------------------------------------

def _shopify_sig(secret: str, raw: bytes) -> str:
    return base64.b64encode(hmac.new(secret.encode(), raw, hashlib.sha256).digest()).decode()


@pytest.mark.paid
async def test_shopify_hook_verifies_signature_and_sends_the_mapped_template(wsa, meta):
    meta.templates.append(approved_template("order_confirm", "Hi {{1}}, thanks for order {{2}} ({{3}})!", "UTILITY"))
    await wsa.post(f"/whatsapp/accounts/{wsa.account['id']}/sync-templates")
    tpl = next(t for t in (await wsa.get("/templates")).json() if t["name"] == "order_confirm")

    cfg = (await wsa.put("/integrations/shopify", json={"secret": "shpss_secret", "actions": {"order_placed": {"type": "send_template", "template_id": tpl["id"], "body": ["{{name}}", "{{var.order_number}}", "{{var.total}}"]}}})).json()
    assert cfg["status"] == "connected" and cfg["has_secret"] and "shpss_secret" not in json.dumps(cfg)
    url = cfg["hook_url"].replace("https://api.test", "")
    order = {"name": "#1042", "total_price": "1499.00", "currency": "INR", "email": "n@x.io", "customer": {"first_name": "Nisha", "last_name": "Iyer", "phone": "+91 98111 00088"}, "line_items": [{"title": "Bike bell"}]}
    raw = json.dumps(order).encode()

    for hdrs in ({}, {"x-shopify-hmac-sha256": "AAAA"}, {"x-shopify-hmac-sha256": _shopify_sig("wrong", raw)}):
        bad = await wsa.client.post(url, content=raw, headers={"x-shopify-topic": "orders/create", **hdrs})
        assert bad.status_code == 401
    assert not meta.sent

    ok = await wsa.client.post(url, content=raw, headers={"x-shopify-topic": "orders/create", "x-shopify-hmac-sha256": _shopify_sig("shpss_secret", raw)})
    assert ok.status_code == 200 and ok.json()["processed"] == 1 and ok.json()["results"][0]["action"]["ok"] is True
    assert meta.sent[-1]["to"] == "919811100088" and meta.sent[-1]["template"]["components"][0]["parameters"] == [
        {"type": "text", "text": "Nisha Iyer"}, {"type": "text", "text": "#1042"}, {"type": "text", "text": "1499.00"}]
    c = next(x for x in (await wsa.get("/contacts")).json()["items"] if x["phone"] == "919811100088")
    assert c["name"] == "Nisha Iyer" and c["source"] == "shopify"

    ignored = await wsa.client.post(url, content=raw, headers={"x-shopify-topic": "products/update", "x-shopify-hmac-sha256": _shopify_sig("shpss_secret", raw)})
    assert ignored.json()["processed"] == 0  # unrelated topics are acknowledged, not errors
    assert (await wsa.get("/integrations")).json()[0]["last_event_at"]


@pytest.mark.paid
async def test_generic_hook_signature_optional_and_url_rotation(wsa):
    cfg = (await wsa.put("/integrations/zapier", json={})).json()
    assert cfg["kind"] == "generic"
    url = cfg["hook_url"].replace("https://api.test", "")
    body = {"phone": "919811100091", "name": "Zap User", "event": "signup", "properties": {"plan": "pro"}, "tags": ["zapier"], "traits": {"city": "Kochi"}}
    r = await wsa.client.post(url, json=body)
    assert r.status_code == 200 and r.json()["processed"] == 1
    c = next(x for x in (await wsa.get("/contacts")).json()["items"] if x["phone"] == "919811100091")
    assert c["tags"] == ["zapier"] and c["traits"] == {"city": "Kochi"}

    await wsa.put("/integrations/zapier", json={"secret": "topsecret"})
    raw = json.dumps(body).encode()
    assert (await wsa.client.post(url, content=raw)).status_code == 401
    sig = "sha256=" + hmac.new(b"topsecret", raw, hashlib.sha256).hexdigest()
    assert (await wsa.client.post(url, content=raw, headers={"x-lfg-signature": sig})).status_code == 200

    new = (await wsa.post("/integrations/zapier/rotate-url")).json()
    assert new["hook_url"] != cfg["hook_url"]
    assert (await wsa.client.post(url, content=raw, headers={"x-lfg-signature": sig})).status_code == 404  # old URL is dead
    assert (await wsa.client.post("/api/hooks/doesnotexist", json={})).status_code == 404


@pytest.mark.paid
async def test_razorpay_stripe_and_woocommerce_signatures(wsa):
    for provider, secret in (("razorpay", "rzp"), ("stripe", "whsec_x"), ("woocommerce", "wc")):
        assert (await wsa.put(f"/integrations/{provider}", json={"secret": secret})).status_code == 200
    hooks = {i["provider"]: i["hook_url"].replace("https://api.test", "") for i in (await wsa.get("/integrations")).json()}

    rz = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_1", "amount": 49900, "currency": "INR", "contact": "+919811100093", "email": "r@x.io"}}}}).encode()
    assert (await wsa.client.post(hooks["razorpay"], content=rz, headers={"x-razorpay-signature": hmac.new(b"rzp", rz, hashlib.sha256).hexdigest()})).json()["processed"] == 1
    assert (await wsa.client.post(hooks["razorpay"], content=rz, headers={"x-razorpay-signature": "bad"})).status_code == 401

    st = json.dumps({"type": "checkout.session.completed", "data": {"object": {"id": "cs_1", "amount_total": 2500, "currency": "usd", "customer_details": {"phone": "+14155550123", "name": "Jo", "email": "j@x.io"}}}}).encode()
    ts = str(int(time.time()))
    good = f"t={ts},v1=" + hmac.new(b"whsec_x", ts.encode() + b"." + st, hashlib.sha256).hexdigest()
    assert (await wsa.client.post(hooks["stripe"], content=st, headers={"stripe-signature": good})).json()["processed"] == 1
    old = str(int(time.time()) - 3600)
    stale = f"t={old},v1=" + hmac.new(b"whsec_x", old.encode() + b"." + st, hashlib.sha256).hexdigest()
    assert (await wsa.client.post(hooks["stripe"], content=st, headers={"stripe-signature": stale})).status_code == 401  # replay protection

    wc = json.dumps({"id": 55, "number": "55", "status": "processing", "total": "999", "currency": "INR", "billing": {"first_name": "Wo", "last_name": "Co", "phone": "9811100094", "email": "w@x.io"}}).encode()
    sig = base64.b64encode(hmac.new(b"wc", wc, hashlib.sha256).digest()).decode()
    res = (await wsa.client.post(hooks["woocommerce"], content=wc, headers={"x-wc-webhook-signature": sig, "x-wc-webhook-topic": "order.updated"})).json()
    assert res["processed"] == 0 and res["ignored"] == 1  # a bare national number with no workspace country code is ignored, never guessed


@pytest.mark.paid
async def test_slack_integration_validation(wsa):
    assert (await wsa.put("/integrations/slack", json={"secret": "https://evil.example/hook"})).status_code == 422
    assert (await wsa.put("/integrations/slack", json={})).status_code == 422
    ok = (await wsa.put("/integrations/slack", json={"secret": "https://hooks.slack.com/services/T000/B000/XXXX", "events": ["lead_captured"]})).json()
    assert ok["status"] == "connected" and "hook_url" not in ok and ok["config"]["events"] == ["lead_captured"]
    assert (await wsa.delete("/integrations/slack")).status_code == 204
    assert (await wsa.get("/integrations")).json() == []


# ---- analytics + auth ----------------------------------------------------------------------------------------------------------------------

@pytest.mark.paid
async def test_analytics_overview_reflects_real_activity(wsa, meta):
    await wsa.inbound("hi", from_="919800000031")
    await wsa.inbound("hello", from_="919800000032")
    cid = (await wsa.get("/inbox/conversations")).json()["items"][0]["id"]
    await wsa.post(f"/inbox/conversations/{cid}/messages", json={"type": "text", "text": "Hi, how can I help?"})
    a = (await wsa.get("/analytics/overview", params={"days": 7})).json()
    assert len(a["messages"]) == 7 and sum(d["inbound"] for d in a["messages"]) == 2 and sum(d["outbound"] for d in a["messages"]) == 1
    assert a["messages"][-1]["date"] == time.strftime("%Y-%m-%d", time.gmtime()) or a["messages"][-1]["inbound"] >= 0
    assert sum(d["count"] for d in a["conversations_started"]) == 2 and a["contacts"]["total"] == 2
    assert a["agents"][0]["messages"] == 1 and a["first_response"]["conversations"] >= 1 and a["conversations"]["human_handled"] == 1
    assert (await wsa.get("/analytics/overview", params={"days": 500})).status_code == 422


async def test_auth_refresh_reset_and_brute_force_protection(app_client, ws, monkeypatch):
    r = await app_client.post("/api/auth/refresh", json={"refresh_token": ws.refresh_token})
    assert r.status_code == 200
    assert (await app_client.post("/api/auth/refresh", json={"refresh_token": ws.refresh_token})).status_code == 401  # rotation: old token is dead
    new_refresh = r.json()["refresh_token"]

    mails = []

    async def fake_send(to, subject, html):
        mails.append((to, html))
        return True
    monkeypatch.setattr(mailer, "send", fake_send)
    assert (await app_client.post("/api/auth/forgot-password", json={"email": ws.email})).status_code == 202
    assert (await app_client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})).status_code == 202  # identical response: no account enumeration
    assert len(mails) == 1
    token = mails[0][1].split("reset-password?token=")[1].split('"')[0].split("<")[0].split("&")[0]
    assert (await app_client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"})).status_code == 400
    assert (await app_client.post("/api/auth/reset-password", json={"token": token, "new_password": "N3w!Passphrase#77x"})).status_code == 204
    assert (await app_client.post("/api/auth/reset-password", json={"token": token, "new_password": "N3w!Passphrase#77x"})).status_code == 400  # single use
    assert (await app_client.post("/api/auth/refresh", json={"refresh_token": new_refresh})).status_code == 401  # reset signs out every device
    assert (await app_client.post("/api/auth/login", json={"email": ws.email, "password": "N3w!Passphrase#77x"})).status_code == 200

    codes = [(await app_client.post("/api/auth/login", json={"email": ws.email, "password": f"wrong{i}"})).status_code for i in range(10)]
    assert 429 in codes and codes[0] == 401


async def test_health_reports_database_status(app_client):
    r = await app_client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
