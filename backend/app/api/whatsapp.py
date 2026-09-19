"""Connect and manage WhatsApp Business numbers."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_manager
from app.core.config import get_settings
from app.models.conversation import Conversation
from app.models.whatsapp_account import WhatsAppAccount
from app.services import quotas
from app.services.phone import InvalidPhone, normalize_phone
from app.services.whatsapp import accounts as svc
from app.services.whatsapp import messaging
from app.services.whatsapp.graph import GraphError
from app.services.whatsapp.templates import sync_templates

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class ConnectManual(BaseModel):
    waba_id: str = Field(min_length=5, max_length=64, pattern=r"^\d+$")
    phone_number_id: str = Field(min_length=5, max_length=64, pattern=r"^\d+$")
    access_token: str = Field(min_length=20, max_length=1000)
    app_secret: str | None = Field(default=None, max_length=200)
    app_id: str | None = Field(default=None, max_length=64)


class ConnectEmbedded(BaseModel):
    code: str = Field(min_length=5)
    waba_id: str = Field(pattern=r"^\d+$")
    phone_number_id: str = Field(pattern=r"^\d+$")


class UpdateCredentials(BaseModel):
    access_token: str | None = Field(default=None, min_length=20, max_length=1000)
    app_secret: str | None = Field(default=None, max_length=200)
    app_id: str | None = Field(default=None, max_length=64)


class TestSend(BaseModel):
    to: str


def _base(request: Request) -> str:
    return svc.public_base(str(request.base_url))


def _out(account: WhatsAppAccount, base: str, *, secrets: bool) -> dict:
    d = {
        "id": str(account.id), "waba_id": account.waba_id, "phone_number_id": account.phone_number_id,
        "display_phone_number": account.display_phone_number, "verified_name": account.verified_name,
        "quality_rating": account.quality_rating, "messaging_limit": account.messaging_limit, "name_status": account.name_status,
        "connection_type": account.connection_type, "status": account.status, "last_error": account.last_error,
        "last_webhook_at": account.last_webhook_at.isoformat() if account.last_webhook_at else None,
        "last_synced_at": account.last_synced_at.isoformat() if account.last_synced_at else None,
        "has_app_secret": bool(account.app_secret_enc or get_settings().meta_app_secret),
        "app_id": (account.settings or {}).get("app_id"),
        "notices": (account.settings or {}).get("notices", [])[-5:],
        "created_at": account.created_at.isoformat() if account.created_at else None,
    }
    if secrets:  # callback details are only meaningful to whoever configures Meta
        d["webhook_url"] = svc.webhook_url(account, base)
        d["verify_token"] = account.verify_token
    return d


async def _owned(db: AsyncSession, ctx: Ctx, account_id: uuid.UUID) -> WhatsAppAccount:
    account = await db.get(WhatsAppAccount, account_id)
    if account is None or account.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "WhatsApp number not found."})
    return account


@router.get("/config")
async def whatsapp_config(request: Request, ctx: Ctx = Depends(get_ctx)) -> dict:
    s = get_settings()
    return {
        "embedded_signup": {"enabled": bool(s.meta_app_id and s.meta_app_secret and s.meta_config_id), "app_id": s.meta_app_id or None,
                            "config_id": s.meta_config_id or None, "graph_version": s.graph_api_version},
        "platform_webhook_url": svc.platform_webhook_url(_base(request)),
        "platform_verify_token": s.meta_webhook_verify_token or None if ctx.is_manager else None,
        "app_secret_required": not bool(s.meta_app_secret),
        "graph_version": s.graph_api_version,
    }


@router.get("/accounts")
async def list_accounts(request: Request, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id).order_by(WhatsAppAccount.created_at))).scalars().all()
    return [_out(a, _base(request), secrets=ctx.is_manager) for a in rows]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def connect_manual(body: ConnectManual, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    count = (await db.execute(select(func.count()).select_from(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status != "disconnected"))).scalar_one()
    await quotas.enforce(db, ctx.tenant_id, "max_whatsapp_numbers", count, label="WhatsApp numbers")
    try:
        account, warnings = await svc.connect_manual(
            db, ctx.tenant_id, waba_id=body.waba_id, phone_number_id=body.phone_number_id, access_token=body.access_token,
            app_secret=body.app_secret, app_id=body.app_id, base_url=_base(request),
        )
    except svc.AccountError as exc:
        raise HTTPException(status_code=exc.status, detail={"error": exc.message})
    try:  # first template sync so the Templates page is immediately useful
        await sync_templates(db, account)
    except GraphError as exc:
        warnings.append(f"Connected, but templates could not be synced yet: {exc}")
    return {**_out(account, _base(request), secrets=True), "warnings": warnings}


@router.post("/accounts/embedded", status_code=status.HTTP_201_CREATED)
async def connect_embedded(body: ConnectEmbedded, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    count = (await db.execute(select(func.count()).select_from(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status != "disconnected"))).scalar_one()
    await quotas.enforce(db, ctx.tenant_id, "max_whatsapp_numbers", count, label="WhatsApp numbers")
    try:
        account, warnings = await svc.connect_embedded(db, ctx.tenant_id, code=body.code, waba_id=body.waba_id, phone_number_id=body.phone_number_id, base_url=_base(request))
    except svc.AccountError as exc:
        raise HTTPException(status_code=exc.status, detail={"error": exc.message})
    try:
        await sync_templates(db, account)
    except GraphError as exc:
        warnings.append(f"Templates could not be synced yet: {exc}")
    return {**_out(account, _base(request), secrets=True), "warnings": warnings}


@router.patch("/accounts/{account_id}")
async def update_account(account_id: uuid.UUID, body: UpdateCredentials, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    account = await _owned(db, ctx, account_id)
    try:
        await svc.update_credentials(db, account, access_token=body.access_token, app_secret=body.app_secret, app_id=body.app_id)
    except svc.AccountError as exc:
        raise HTTPException(status_code=exc.status, detail={"error": exc.message})
    return _out(account, _base(request), secrets=True)


@router.post("/accounts/{account_id}/refresh")
async def refresh(account_id: uuid.UUID, request: Request, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    account = await _owned(db, ctx, account_id)
    try:
        await svc.refresh_account(db, account)
    except GraphError as exc:
        raise HTTPException(status_code=502, detail={"error": f"Could not reach WhatsApp: {exc}"})
    return _out(account, _base(request), secrets=ctx.is_manager)


@router.post("/accounts/{account_id}/sync-templates")
async def sync(account_id: uuid.UUID, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    account = await _owned(db, ctx, account_id)
    try:
        return await sync_templates(db, account)
    except GraphError as exc:
        raise HTTPException(status_code=502, detail={"error": f"Template sync failed: {exc}"})


@router.post("/accounts/{account_id}/test")
async def send_test(account_id: uuid.UUID, body: TestSend, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    """Send Meta's built-in `hello_world` template — the standard way to confirm a number can send."""
    account = await _owned(db, ctx, account_id)
    try:
        phone = normalize_phone(body.to)
    except InvalidPhone as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc)})
    contact, _ = await messaging.upsert_contact(db, ctx.tenant_id, phone, source="manual")
    conv, _ = await messaging.get_or_create_conversation(db, account, contact)
    try:
        msg = await messaging.send_message(db, account, conv, contact, kind="template", template_name="hello_world", template_language="en_US",
                                           template_preview="Hello World — test message", sender_type="agent", sender_user_id=ctx.user_id)
    except GraphError as exc:
        raise HTTPException(status_code=502, detail={"error": str(exc), "code": exc.code})
    return {"ok": True, "wamid": msg.wamid, "conversation_id": str(conv.id)}


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def disconnect(account_id: uuid.UUID, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> None:
    """Soft-disconnect: sending stops but conversation history is kept. Reconnecting the same number re-enables it."""
    account = await _owned(db, ctx, account_id)
    has_history = (await db.execute(select(func.count()).select_from(Conversation).where(Conversation.account_id == account.id))).scalar_one()
    if has_history:
        account.status = "disconnected"
    else:
        await db.delete(account)
    await db.commit()


@router.post("/accounts/{account_id}/reconnect")
async def reconnect(account_id: uuid.UUID, request: Request, ctx: Ctx = Depends(require_manager), db: AsyncSession = Depends(get_db)) -> dict:
    account = await _owned(db, ctx, account_id)
    account.status = "connected"
    try:
        await svc.refresh_account(db, account)
    except GraphError as exc:
        account.status, account.last_error = "error", str(exc)[:500]
        await db.commit()
        raise HTTPException(status_code=400, detail={"error": f"Reconnect failed — update the access token: {exc}"})
    return _out(account, _base(request), secrets=True)


