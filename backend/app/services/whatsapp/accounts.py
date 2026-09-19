"""Connecting, refreshing and disconnecting WhatsApp Business numbers."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.core.crypto import decrypt, encrypt
from app.models.whatsapp_account import WhatsAppAccount
from app.services.whatsapp.graph import GraphClient, GraphError, exchange_code_for_token

log = logging.getLogger(__name__)


class AccountError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def public_base(request_base: str | None = None) -> str:
    return (get_settings().public_base_url or request_base or "").rstrip("/")


def webhook_url(account: WhatsAppAccount, base: str) -> str:
    return f"{base.rstrip('/')}/api/webhooks/whatsapp/{account.webhook_key}"


def platform_webhook_url(base: str) -> str:
    return f"{base.rstrip('/')}/api/webhooks/whatsapp"


def apply_phone_info(account: WhatsAppAccount, info: dict) -> None:
    account.display_phone_number = info.get("display_phone_number") or account.display_phone_number
    account.verified_name = info.get("verified_name") or account.verified_name
    account.quality_rating = info.get("quality_rating") or account.quality_rating or "UNKNOWN"
    account.name_status = info.get("name_status") or account.name_status
    account.messaging_limit = info.get("messaging_limit_tier") or account.messaging_limit


async def refresh_account(db: AsyncSession, account: WhatsAppAccount) -> None:
    """Re-read phone number status/quality from Meta. Marks the account errored if the token no longer works."""
    try:
        info = await GraphClient(decrypt(account.access_token_enc)).get_phone_number(account.phone_number_id)
    except GraphError as exc:
        if exc.is_auth_error:
            account.status, account.last_error = "error", str(exc)[:500]
            await db.commit()
        raise
    apply_phone_info(account, info)
    if account.status == "error":
        account.status, account.last_error = "connected", None
    account.last_synced_at = datetime.now(timezone.utc)
    await db.commit()


async def _ensure_unique(db: AsyncSession, tenant_id: uuid.UUID, phone_number_id: str) -> None:
    existing = (await db.execute(select(WhatsAppAccount).where(WhatsAppAccount.phone_number_id == phone_number_id))).scalar_one_or_none()
    if existing is not None:
        who = "this workspace" if existing.tenant_id == tenant_id else "another workspace"
        raise AccountError(f"This phone number is already connected to {who}.", 409)


async def connect_manual(db: AsyncSession, tenant_id: uuid.UUID, *, waba_id: str, phone_number_id: str, access_token: str,
                         app_secret: str | None, app_id: str | None, base_url: str) -> tuple[WhatsAppAccount, list[str]]:
    """Validate credentials against Meta, then store them encrypted. Returns (account, warnings)."""
    settings = get_settings()
    if not app_secret and not settings.meta_app_secret:
        raise AccountError("Meta App Secret is required — it is used to verify that webhooks really come from Meta.")
    await _ensure_unique(db, tenant_id, phone_number_id)

    client = GraphClient(access_token)
    try:
        info = await client.get_phone_number(phone_number_id)
    except GraphError as exc:
        raise AccountError(f"Meta rejected these credentials: {exc}", 400 if not exc.is_transient else 502) from exc

    account = WhatsAppAccount(
        tenant_id=tenant_id, waba_id=waba_id, phone_number_id=phone_number_id, access_token_enc=encrypt(access_token),
        app_secret_enc=encrypt(app_secret) if app_secret else None, webhook_key=secrets.token_urlsafe(24),
        verify_token=secrets.token_urlsafe(24), connection_type="manual", status="connected", settings={"app_id": app_id} if app_id else {},
    )
    apply_phone_info(account, info)
    account.last_synced_at = datetime.now(timezone.utc)
    db.add(account)
    await db.flush()

    warnings: list[str] = []
    try:  # point this WABA's webhooks at our per-account URL. Not all tokens are allowed to; that's non-fatal.
        await client.subscribe_app(waba_id, callback_uri=webhook_url(account, base_url), verify_token=account.verify_token)
    except GraphError as exc:
        warnings.append(f"Couldn't auto-subscribe webhooks ({exc}). Add the callback URL and verify token in your Meta app's WhatsApp > Configuration.")
    await db.commit()
    return account, warnings


async def connect_embedded(db: AsyncSession, tenant_id: uuid.UUID, *, code: str, waba_id: str, phone_number_id: str, base_url: str) -> tuple[WhatsAppAccount, list[str]]:
    """Meta Embedded Signup finish: exchange the code, subscribe the app, register the number."""
    await _ensure_unique(db, tenant_id, phone_number_id)
    try:
        token = await exchange_code_for_token(code)
    except GraphError as exc:
        raise AccountError(f"Could not complete WhatsApp signup: {exc}", 400) from exc
    client = GraphClient(token)
    try:
        info = await client.get_phone_number(phone_number_id)
    except GraphError as exc:
        raise AccountError(f"Signup finished but the number could not be read: {exc}", 502) from exc

    pin = f"{secrets.randbelow(900000) + 100000}"
    account = WhatsAppAccount(
        tenant_id=tenant_id, waba_id=waba_id, phone_number_id=phone_number_id, access_token_enc=encrypt(token),
        webhook_key=secrets.token_urlsafe(24), verify_token=secrets.token_urlsafe(24), connection_type="embedded", status="connected",
        settings={"two_step_pin_enc": encrypt(pin)},
    )
    apply_phone_info(account, info)
    account.last_synced_at = datetime.now(timezone.utc)
    db.add(account)
    await db.flush()

    warnings: list[str] = []
    try:
        await client.subscribe_app(waba_id)  # uses the platform app's own webhook config
    except GraphError as exc:
        warnings.append(f"Webhook subscription failed: {exc}")
    try:
        await client.register_phone(phone_number_id, pin)
    except GraphError as exc:
        if exc.code != 133016:  # already registered recently — fine
            warnings.append(f"Number registration: {exc}")
    await db.commit()
    return account, warnings


async def update_credentials(db: AsyncSession, account: WhatsAppAccount, *, access_token: str | None, app_secret: str | None, app_id: str | None) -> None:
    if access_token:
        try:
            await GraphClient(access_token).get_phone_number(account.phone_number_id)
        except GraphError as exc:
            raise AccountError(f"Meta rejected the new token: {exc}") from exc
        account.access_token_enc = encrypt(access_token)
        account.status, account.last_error = "connected", None
    if app_secret:
        account.app_secret_enc = encrypt(app_secret)
    if app_id is not None:
        account.settings = {**(account.settings or {}), "app_id": app_id}
        flag_modified(account, "settings")
    await db.commit()
