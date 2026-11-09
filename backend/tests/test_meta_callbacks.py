"""Facebook Login deauthorize / data-deletion callbacks: Meta's signed_request must verify against the app secret."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json

import pytest

from app.core.config import get_settings
from tests.conftest import APP_SECRET


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def signed_request(payload: dict, secret: str = APP_SECRET) -> str:
    body = _b64(json.dumps(payload).encode())
    return _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()) + "." + body


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(get_settings(), "meta_app_secret", APP_SECRET)


FORM = {"content-type": "application/x-www-form-urlencoded"}
PAYLOAD = {"algorithm": "HMAC-SHA256", "issued_at": 1762700000, "user_id": "1234567890"}


async def test_data_deletion_returns_status_url_and_code(app_client):
    r = await app_client.post("/api/meta/data-deletion", content=f"signed_request={signed_request(PAYLOAD)}", headers=FORM)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["confirmation_code"].startswith("TFG-")
    assert body["url"].endswith(f"/data-deletion?code={body['confirmation_code']}")


async def test_data_deletion_rejects_bad_signature(app_client):
    forged = signed_request(PAYLOAD, secret="not-the-app-secret")
    r = await app_client.post("/api/meta/data-deletion", content=f"signed_request={forged}", headers=FORM)
    assert r.status_code == 400


async def test_data_deletion_rejects_missing_request(app_client):
    r = await app_client.post("/api/meta/data-deletion", content="", headers=FORM)
    assert r.status_code == 400


async def test_deauthorize(app_client):
    r = await app_client.post("/api/meta/deauthorize", content=f"signed_request={signed_request(PAYLOAD)}", headers=FORM)
    assert r.status_code == 200 and r.json() == {"success": True}
