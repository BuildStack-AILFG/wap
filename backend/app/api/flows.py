from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant_id, get_db
from app.models.automation_flow import AutomationFlow
from app.schemas.flows import FlowCreate, FlowOut

router = APIRouter(prefix="/flows", tags=["flows"])


@router.get("", response_model=list[FlowOut])
async def list_flows(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[AutomationFlow]:
    result = await db.execute(
        select(AutomationFlow).where(AutomationFlow.tenant_id == tenant_id).order_by(AutomationFlow.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=FlowOut, status_code=201)
async def create_flow(
    body: FlowCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> AutomationFlow:
    flow = AutomationFlow(
        tenant_id=tenant_id,
        name=body.name,
        trigger_type=body.trigger_type,
        status="draft",
        graph={"nodes": [], "edges": []},
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow
