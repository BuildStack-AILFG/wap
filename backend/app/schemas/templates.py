from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")

TemplateCategory = Literal["MARKETING", "UTILITY", "AUTHENTICATION"]


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    language: str = Field(default="en", max_length=16)
    category: TemplateCategory
    body: str = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not NAME_PATTERN.match(v):
            raise ValueError("Template name must be lowercase letters, numbers, and underscores only.")
        return v


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    language: str
    category: str
    body: str
    status: str
    updated_at: datetime
