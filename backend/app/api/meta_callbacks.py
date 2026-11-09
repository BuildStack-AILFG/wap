"""Meta app callbacks (no login): Facebook Login "Deauthorize" and "Data Deletion Request".

Meta POSTs a form-encoded `signed_request` (base64url(HMAC-SHA256 sig) + "." + base64url(JSON payload)) signed with the app secret.
The data-deletion callback must answer with JSON {url, confirmation_code}; the url is where the person can check their request.

We never store Facebook user ids or profile data: Embedded Signup only gives us a business token for the WhatsApp Business Account
the business chose to share, which lives with that workspace. So a request is verified, logged with its confirmation code, and the
status page explains how a business removes its connected number / workspace data.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
from urllib.parse import parse_qs, quote

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/meta", tags=["meta"])


def _b64url(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def parse_signed_request(signed_request: str, secret: str) -> dict:
    """Verify and decode a Meta signed_request. Raises ValueError when it is malformed or the signature doesn't match."""
    if not secret:
        raise ValueError("META_APP_SECRET is not set")
    try:
        sig_part, payload_part = signed_request.split(".", 1)
        sig = _b64url(sig_part)
        data = json.loads(_b64url(payload_part))
    except Exception as exc:  # noqa: BLE001 — any decode failure is a bad request
        raise ValueError("malformed signed_request") from exc
    if str(data.get("algorithm", "")).upper() != "HMAC-SHA256":
        raise ValueError("unsupported algorithm")
    expected = hmac.new(secret.encode(), payload_part.encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("bad signature")
    return data


async def _verified(request: Request) -> dict:
    raw = (await request.body()).decode("utf-8", "replace")
    signed = (parse_qs(raw).get("signed_request") or [""])[0]
    try:
        return parse_signed_request(signed, get_settings().meta_app_secret)
    except ValueError as exc:
        log.warning("Rejected Meta callback on %s: %s", request.url.path, exc)
        raise HTTPException(status_code=400, detail="Invalid signed_request") from exc


@router.post("/deauthorize")
async def deauthorize(request: Request) -> dict:
    data = await _verified(request)
    log.info("Meta deauthorize callback for app-scoped user %s", data.get("user_id"))
    return {"success": True}


@router.post("/data-deletion")
async def data_deletion(request: Request) -> dict:
    data = await _verified(request)
    code = "TFG-" + secrets.token_hex(6).upper()
    log.info("Meta data deletion request %s for app-scoped user %s", code, data.get("user_id"))
    base = get_settings().app_url(request.headers.get("origin"))
    return {"url": f"{base}/data-deletion?code={quote(code)}", "confirmation_code": code}
