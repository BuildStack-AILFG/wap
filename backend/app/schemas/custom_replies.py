from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CustomReplyCreate(BaseModel):
    trigger: str = Field(min_length=1, max_length=500)
    reply_text: str = Field(min_length=1)


class CustomReplyUpdate(BaseModel):
    trigger: str | None = None
    reply_text: str | None = None
    enabled: bool | None = None


class CustomReplyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trigger: str
    reply_text: str
    enabled: bool
    conversations_sent: int
    updated_at: datetime
