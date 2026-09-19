from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TriggerType = Literal["incoming_message", "keyword", "contact_created", "manual", "webhook"]


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    trigger_type: TriggerType = "incoming_message"


class FlowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    trigger_type: str
    status: str
    conversations_sent: int
    updated_at: datetime
