"""Coexistence: a number onboarded from the WhatsApp Business app keeps working on the phone, and its contacts, history and phone replies
flow into the inbox. Payload shapes follow Meta's smb_message_echoes / history / smb_app_state_sync webhook references."""

from __future__ import annotations

import re
import secrets
import time

import httpx
import pytest

from app.core.config import get_settings
from tests.conftest import APP_SECRET

CUSTOMER = "919811112222"
WABA = PHONE_ID = ""  # fresh per test: the test database is shared across tests


@pytest.fixture
def platform_app(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "meta_app_id", "28266016336340992")
    monkeypatch.setattr(s, "meta_app_secret", APP_SECRET)
    monkeypatch.setattr(s, "meta_config_id", "2393305401412321")


@pytest.fixture
def coex_meta(meta, platform_app):  # noqa: ARG001
    global WABA, PHONE_ID
    WABA, PHONE_ID = "7" + str(secrets.randbelow(10**12)).zfill(12), "8" + str(secrets.randbelow(10**12)).zfill(12)

    def override(request: httpx.Request):
        rest = re.sub(r"^/v[\d.]+/", "", request.url.path)
        if rest == "oauth/access_token":
            return httpx.Response(200, json={"access_token": meta.token})
        if rest == f"{WABA}/phone_numbers":
            return httpx.Response(200, json={"data": [{"id": PHONE_ID, "display_phone_number": "+91 93353 90409"}]})
        if rest == f"{PHONE_ID}/smb_app_data":
            return httpx.Response(200, json={"request_id": f"req-{len(meta.calls)}"})
        return None
    meta.override = override
    return meta


async def _connect(ws, **extra):
    r = await ws.post("/whatsapp/accounts/embedded", json={"code": "auth-code-123", "waba_id": WABA, "coexistence": True, **extra})
    assert r.status_code == 201, r.text
    ws.account, ws.phone_number_id = r.json(), PHONE_ID
    return ws.account


def _env(field: str, value: dict) -> dict:
    value = {"messaging_product": "whatsapp", "metadata": {"display_phone_number": "919335390409", "phone_number_id": PHONE_ID}, **value}
    return {"object": "whatsapp_business_account", "entry": [{"id": WABA, "changes": [{"field": field, "value": value}]}]}


async def test_coexistence_connect_skips_registration_and_requests_sync(ws, coex_meta):
    acct = await _connect(ws)
    assert acct["connection_type"] == "coexistence" and acct["phone_number_id"] == PHONE_ID
    paths = [c["path"] for c in coex_meta.calls]
    assert not any(p.endswith("/register") for p in paths)  # number already registered on the Business app
    syncs = [c["body"]["sync_type"] for c in coex_meta.calls if c["path"].endswith("/smb_app_data")]
    assert syncs == ["smb_app_state_sync", "history"]  # contacts first, then history


async def test_regular_embedded_signup_still_registers(ws, coex_meta):
    r = await ws.post("/whatsapp/accounts/embedded", json={"code": "auth-code-123", "waba_id": WABA, "phone_number_id": PHONE_ID})
    assert r.status_code == 201 and r.json()["connection_type"] == "embedded"
    assert any(c["path"].endswith("/register") for c in coex_meta.calls)
    assert not any(c["path"].endswith("/smb_app_data") for c in coex_meta.calls)


async def test_contacts_history_and_phone_replies_reach_the_inbox(ws, coex_meta):
    await _connect(ws)
    now = int(time.time())

    r = await ws.webhook(_env("smb_app_state_sync", {"state_sync": [
        {"type": "contact", "contact": {"full_name": "Pablo Morales", "first_name": "Pablo", "phone_number": CUSTOMER}, "action": "add", "metadata": {"timestamp": str(now)}},
        {"type": "contact", "contact": {"phone_number": "919800000000"}, "action": "remove", "metadata": {"timestamp": str(now)}},
    ]}))
    assert r.status_code == 200
    contacts = (await ws.get("/contacts")).json()
    assert contacts["total"] == 1 and contacts["items"][0]["name"] == "Pablo Morales"

    history = _env("history", {"history": [{"metadata": {"phase": 0, "chunk_order": 1, "progress": 100}, "threads": [{"id": CUSTOMER, "messages": [
        {"from": CUSTOMER, "id": "wamid.H1", "timestamp": str(now - 300), "type": "text", "text": {"body": "Is the shop open?"}, "history_context": {"status": "READ"}},
        {"from": "919335390409", "to": CUSTOMER, "id": "wamid.H2", "timestamp": str(now - 200), "type": "text", "text": {"body": "Yes, till 9"}, "history_context": {"status": "READ"}},
        {"from": CUSTOMER, "id": "wamid.H3", "timestamp": str(now - 100), "type": "media_placeholder"},
    ]}]}]})
    r = await ws.webhook(history)
    assert r.json()["messages"] == 3
    assert (await ws.webhook(history)).json()["duplicates"] == 3  # chunks can be redelivered

    r = await ws.webhook(_env("smb_message_echoes", {"message_echoes": [
        {"from": "919335390409", "to": CUSTOMER, "id": "wamid.E1", "timestamp": str(now), "type": "text", "text": {"body": "Sent from my phone"}},
        {"from": "919335390409", "to": CUSTOMER, "id": "wamid.E2", "timestamp": str(now), "type": "revoke", "revoke": {"original_message_id": "wamid.E1"}},
    ]}))
    assert r.json()["messages"] == 1

    conv = (await ws.get("/inbox/conversations")).json()["items"][0]
    assert conv["unread_count"] == 0  # imported/echoed messages aren't new to the business
    assert conv["last_message_preview"] == "Sent from my phone"
    msgs = (await ws.get(f"/inbox/conversations/{conv['id']}/messages")).json()["items"]
    assert [(m["direction"], m["sender_type"]) for m in msgs] == [("in", "contact"), ("out", "business_app"), ("in", "contact"), ("out", "business_app")]
    assert msgs[1]["status"] == "read" and msgs[2]["body"].startswith("Media")
    assert not coex_meta.sent  # nothing triggered an automated reply


async def test_history_declined_is_recorded(ws, coex_meta):
    await _connect(ws)
    r = await ws.webhook({"messaging_product": "whatsapp", "metadata": {"display_phone_number": "919335390409", "phone_number_id": PHONE_ID},
                          "history": [{"errors": [{"code": 2593109, "title": "History sync is turned off", "message": "History sync is turned off by the business"}]}]})
    assert r.status_code == 200
    from sqlalchemy import select

    from app.models.whatsapp_account import WhatsAppAccount
    from tests.conftest import db_session
    async with await db_session() as db:
        row = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.phone_number_id == PHONE_ID))).scalar_one()
        assert "2593109" in row.settings["coexistence_sync"]["history_error"]
