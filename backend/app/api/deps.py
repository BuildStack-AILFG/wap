from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.tenant import User

__all__ = ["get_db", "get_current_user", "get_current_tenant_id"]


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:]
    return request.cookies.get("access_token")


def _decode_request_token(request: Request) -> dict:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Authentication required."})

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Invalid or expired session."})
    return payload


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    payload = _decode_request_token(request)

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Invalid session."})

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Account no longer active."})

    return user


def get_current_tenant_id(request: Request) -> uuid.UUID:
    """Every tenant-scoped router depends on this instead of re-decoding the token."""
    payload = _decode_request_token(request)

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "No workspace on this session."})

    try:
        return uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Invalid session."})


# ---- request context with live role verification ------------------------------------------------------------------

from dataclasses import dataclass  # noqa: E402

from sqlalchemy import select  # noqa: E402

from app.models.tenant import TenantMembership  # noqa: E402

MANAGER_ROLES = {"owner", "admin"}
WRITER_ROLES = {"owner", "admin", "agent"}


@dataclass
class Ctx:
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role: str

    @property
    def is_manager(self) -> bool:
        return self.role in MANAGER_ROLES


async def get_ctx(request: Request, db: AsyncSession = Depends(get_db)) -> Ctx:
    """Tenant + user + *current* role. Unlike the JWT claim this reflects removals/role changes immediately."""
    payload = _decode_request_token(request)
    try:
        tenant_id, user_id = uuid.UUID(payload["tenant_id"]), uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Invalid session."})
    membership = (await db.execute(
        select(TenantMembership.role).where(TenantMembership.tenant_id == tenant_id, TenantMembership.user_id == user_id)
    )).scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "You no longer have access to this workspace."})
    return Ctx(tenant_id=tenant_id, user_id=user_id, role=membership)


async def require_manager(ctx: Ctx = Depends(get_ctx)) -> Ctx:
    if not ctx.is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "Only workspace owners and admins can do this."})
    return ctx


async def require_writer(ctx: Ctx = Depends(get_ctx)) -> Ctx:
    if ctx.role not in WRITER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "Your role is read-only."})
    return ctx
