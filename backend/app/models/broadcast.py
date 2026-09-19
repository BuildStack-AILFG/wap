"""Broadcast campaign — see the plan file's system design §4.9."""

from __future__ import annotations

import uuid

from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Broadcast(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "broadcasts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("whatsapp_templates.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|scheduled|sending|completed

    audience: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # {type: all_contacts|tag, tag?}

    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent: Mapped[int] = mapped_column(Integer, default=0)
    delivered: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
