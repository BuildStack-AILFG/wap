"""Keyword-triggered custom auto-reply — a lightweight sibling to the flow engine (§4.8)."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CustomReply(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "custom_replies"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    trigger: Mapped[str] = mapped_column(String(500), nullable=False)
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    conversations_sent: Mapped[int] = mapped_column(Integer, default=0)
