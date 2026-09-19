from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AudienceType = Literal["all_contacts", "tag"]


class BroadcastCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    template_id: uuid.UUID
    audience_type: AudienceType
    audience_tag: str | None = None


class BroadcastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: str
    audience: dict
    total_recipients: int
    sent: int
    delivered: int
    failed: int
    created_at: datetime
