from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=32)
    email: str | None = None
    tags: list[str] = Field(default_factory=list)


class ContactUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None
    opted_out: bool | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    tags: list[str]
    source: str
    opted_out: bool
    last_contacted_at: datetime | None
    created_at: datetime
