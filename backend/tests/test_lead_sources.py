"""Pulled lead sources: IndiaMART Lead Manager and Google Sheets, with the HTTP side faked."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.models.integration import Integration
from app.services import lead_sources
from tests.conftest import db_session

pytestmark = pytest.mark.paid  # integrations are a paid feature

SHEET = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=42"


class FakeHttp:
    def __init__(self):
        self.calls: list[httpx.Request] = []
        self.indiamart: dict = {"CODE": 204, "STATUS": "SUCCESS", "MESSAGE": "", "TOTAL_RECORDS": 0, "RESPONSE": []}
        self.sheet: tuple[int, str, str] = (200, "text/csv; charset=utf-8", "phone,name\n")

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        if request.url.host == "mapi.indiamart.com":
            return httpx.Response(200, json=self.indiamart)
        if request.url.host == "docs.google.com":
            status, ctype, body = self.sheet
            return httpx.Response(status, headers={"content-type": ctype}, text=body)
        return httpx.Response(404)


@pytest.fixture
def http(monkeypatch) -> FakeHttp:
    fake = FakeHttp()
    real = httpx.AsyncClient

    def client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(fake.handler)
        return real(*args, **kwargs)
    monkeypatch.setattr(lead_sources.httpx, "AsyncClient", client)
    return fake


def lead(qid: str, mobile: str | None, name: str = "Rakesh Gupta", message: str = "Need 500 steel racks, please share price") -> dict:
    return {"UNIQUE_QUERY_ID": qid, "QUERY_TYPE": "W", "QUERY_TIME": "2026-10-12 10:15:00", "SENDER_NAME": name, "SENDER_MOBILE": mobile,
            "SENDER_EMAIL": "rakesh@example.com", "SENDER_COUNTRY_ISO": "IN", "QUERY_MESSAGE": message, "QUERY_PRODUCT_NAME": "Steel Rack", "SENDER_CITY": "Pune"}


async def _expire_rate_limit(ws, provider: str) -> None:
    async with await db_session() as db:
        row = next(r for r in (await db.execute(__import__("sqlalchemy").select(Integration).where(Integration.tenant_id == uuid.UUID(ws.tenant_id)))).scalars() if r.provider == provider)
        row.config = {**row.config, "last_call_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
        await db.commit()


async def _contacts(ws) -> dict[str, dict]:
    return {c["phone"]: c for c in (await ws.get("/contacts")).json()["items"]}


async def test_indiamart_pulls_new_enquiries_once(wsa, http):
    seq = (await wsa.post("/followups", json={"name": "IndiaMART leads", "trigger": "new_lead", "trigger_value": "indiamart",
                                              "steps": [{"kind": "text", "delay_minutes": 30, "text": "Hi {{first_name}}, about your enquiry…"}]})).json()
    r = await wsa.put("/integrations/indiamart", json={"secret": "imkey-1234567890abcdef"})
    assert r.status_code == 200, r.text
    assert "hook_url" not in r.json() and "recent_ids" not in r.json()["config"]

    http.indiamart = {"CODE": 200, "STATUS": "SUCCESS", "TOTAL_RECORDS": 2, "RESPONSE": [lead("Q1", "+91-9876500001"), lead("Q2", None, name="No Phone")]}
    out = await wsa.post("/integrations/indiamart/sync")
    assert out.status_code == 200, out.text
    assert out.json()["new_leads"] == 1
    params = http.calls[-1].url.params
    assert params["glusr_crm_key"] == "imkey-1234567890abcdef"
    assert re.fullmatch(r"\d{2}-\d{2}-\d{4}\d{2}:\d{2}:\d{2}", params["start_time"]) and re.fullmatch(r"\d{2}-\d{2}-\d{4}\d{2}:\d{2}:\d{2}", params["end_time"])

    c = (await _contacts(wsa))["919876500001"]
    assert c["name"] == "Rakesh Gupta" and c["source"] == "indiamart" and "indiamart" in c["tags"]
    assert c["traits"]["indiamart_enquiry"].startswith("Need 500 steel racks") and c["traits"]["city"] == "Pune"
    assert [e["source"] for e in (await wsa.get(f"/followups/{seq['id']}/enrollments")).json()] == ["new_lead"]

    # IndiaMART allows one call per 5 minutes
    again = await wsa.post("/integrations/indiamart/sync")
    assert again.status_code == 422 and "5 minutes" in again.json()["detail"]["error"]

    # the overlapping window returns Q1 again: it isn't processed twice
    await _expire_rate_limit(wsa, "indiamart")
    assert (await wsa.post("/integrations/indiamart/sync")).json()["new_leads"] == 0
    assert len(await _contacts(wsa)) == 1


async def test_indiamart_errors_show_on_the_integration(wsa, http):
    await wsa.put("/integrations/indiamart", json={"secret": "imkey-1234567890abcdef"})
    http.indiamart = {"CODE": 429, "STATUS": "FAILURE", "MESSAGE": "It is advised to hit this API once in every 5 minutes"}
    r = await wsa.post("/integrations/indiamart/sync")
    assert r.status_code == 422 and "once in every 5 minutes" in r.json()["detail"]["error"]
    row = next(i for i in (await wsa.get("/integrations")).json() if i["provider"] == "indiamart")
    assert row["status"] == "error" and "5 minutes" in row["last_error"]


async def _india(ws) -> None:
    assert (await ws.patch("/settings", json={"settings": {"default_country_code": "91"}})).status_code == 200


async def test_google_sheet_imports_only_new_rows(wsa, http):
    await _india(wsa)
    assert (await wsa.put("/integrations/google-sheets", json={"secret": "https://example.com/sheet"})).status_code == 422
    assert (await wsa.put("/integrations/google-sheets", json={"secret": SHEET})).status_code == 200

    http.sheet = (200, "text/csv", "Phone,Name,City\n9876500011,Old Lead,Pune\n9876500012,Older Lead,Mumbai\n")
    first = (await wsa.post("/integrations/google-sheets/sync")).json()
    assert first["new_leads"] == 0 and first["skipped_existing_rows"] == 2  # rows already there aren't messaged
    assert "export?format=csv&gid=42" in str(http.calls[-1].url)

    http.sheet = (200, "text/csv", "Phone,Name,City\n9876500011,Old Lead,Pune\n9876500012,Older Lead,Mumbai\n9876500013,Neha Rao,Nashik\n,,\n")
    second = (await wsa.post("/integrations/google-sheets/sync")).json()
    assert second["new_leads"] == 1
    contacts = await _contacts(wsa)
    assert list(contacts) == ["919876500013"] and contacts["919876500013"]["traits"]["city"] == "Nashik" and "google-sheets" in contacts["919876500013"]["tags"]
    assert (await wsa.post("/integrations/google-sheets/sync")).json()["new_leads"] == 0


async def test_google_sheet_can_import_existing_rows_and_explains_private_sheets(wsa, http):
    await _india(wsa)
    await wsa.put("/integrations/google-sheets", json={"secret": SHEET, "import_existing": True})
    http.sheet = (200, "text/csv", "mobile,full_name\n9876500021,Arjun\n9876500022,Kavya\n")
    assert (await wsa.post("/integrations/google-sheets/sync")).json()["new_leads"] == 2

    http.sheet = (200, "text/html", "<html>Sign in</html>")  # a sheet that isn't shared returns Google's sign-in page
    r = await wsa.post("/integrations/google-sheets/sync")
    assert r.status_code == 422 and "Anyone with the link" in r.json()["detail"]["error"]


async def test_pulled_sources_have_no_public_hook(wsa, app_client):
    await wsa.put("/integrations/indiamart", json={"secret": "imkey-1234567890abcdef"})
    async with await db_session() as db:
        token = next(r.hook_token for r in (await db.execute(__import__("sqlalchemy").select(Integration).where(Integration.tenant_id == uuid.UUID(wsa.tenant_id)))).scalars())
    assert (await app_client.post(f"/api/hooks/{token}", json={"phone": "919800000000"})).status_code == 404
