"""
Generic tenant-settings blob (§4.1 `tenants.settings` JSONB) — used by the simpler
toggle-shaped pages (Auto-Replies, AI Agent, Intent Matching) that don't warrant
their own table. Shallow merge, one level deep: PATCH {"auto_replies": {...}}
replaces only the `auto_replies` key, leaving sibling keys (`ai_agents`, etc.) untouched.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_tenant_id, get_db
from app.models.tenant import Tenant
from app.schemas.settings import SettingsOut, SettingsPatch

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
async def get_settings(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Workspace not found."})
    return SettingsOut(settings=tenant.settings)


@router.patch("", response_model=SettingsOut)
async def patch_settings(
    body: SettingsPatch,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "Workspace not found."})

    merged = {**tenant.settings, **body.settings}
    tenant.settings = merged
    flag_modified(tenant, "settings")
    await db.commit()
    return SettingsOut(settings=tenant.settings)
