"""Public webhook endpoints Meta calls. No auth header — authenticity is proven by the X-Hub-Signature-256 HMAC."""

from __future__ import annotations

import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.models.whatsapp_account import WhatsAppAccount
from app.services.automation import dispatcher
from app.services.whatsapp import inbound

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
MAX_BODY = 2 * 1024 * 1024


def _challenge(mode: str | None, token: str | None, challenge: str | None, expected: str) -> PlainTextResponse:
    if mode == "subscribe" and expected and token and hmac.compare_digest(token, expected):
        return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail={"error": "Webhook verification failed."})


@router.get("/whatsapp")
async def verify_platform(hub_mode: str | None = Query(None, alias="hub.mode"), hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
                          hub_challenge: str | None = Query(None, alias="hub.challenge")) -> PlainTextResponse:
    return _challenge(hub_mode, hub_verify_token, hub_challenge, get_settings().meta_webhook_verify_token)


@router.get("/whatsapp/{key}")
async def verify_account(key: str, hub_mode: str | None = Query(None, alias="hub.mode"), hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
                         hub_challenge: str | None = Query(None, alias="hub.challenge"), db: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.webhook_key == key))).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail={"error": "Unknown webhook."})
    return _challenge(hub_mode, hub_verify_token, hub_challenge, account.verify_token)


async def _receive(request: Request, background: BackgroundTasks, db: AsyncSession, account: WhatsAppAccount | None) -> dict:
    raw = await request.body()
    if len(raw) > MAX_BODY:
        raise HTTPException(status_code=413, detail={"error": "Payload too large."})
    secret = inbound.app_secret_for(account)
    if not inbound.verify_signature(raw, request.headers.get("x-hub-signature-256"), secret):
        # Never process unsigned/forged events. (No secret configured also lands here — fail closed.)
        raise HTTPException(status_code=401, detail={"error": "Invalid signature."})
    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "Invalid JSON."})
    if payload.get("object") != "whatsapp_business_account":
        return {"ok": True, "ignored": True}

    result = await inbound.ingest(db, payload, account=account)
    for message_id in result.dispatch:  # automation/AI can be slow — never make Meta wait on it
        background.add_task(dispatcher.dispatch_inbound, message_id)
    return {"ok": True, "messages": result.messages, "statuses": result.statuses, "duplicates": result.duplicates}


@router.post("/whatsapp")
async def receive_platform(request: Request, background: BackgroundTasks, db: AsyncSession = Depends(get_db)) -> dict:
    return await _receive(request, background, db, None)


@router.post("/whatsapp/{key}")
async def receive_account(key: str, request: Request, background: BackgroundTasks, db: AsyncSession = Depends(get_db)) -> dict:
    account = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.webhook_key == key))).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail={"error": "Unknown webhook."})
    return await _receive(request, background, db, account)
