"""WhatsApp message template — see the plan file's system design §4.7."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WhatsAppTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "language", name="uq_templates_tenant_name_language"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    category: Mapped[str] = mapped_column(String(32), nullable=False)  # MARKETING|UTILITY|AUTHENTICATION
    body: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(String(16), default="pending")  # draft|pending|approved|rejected
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    meta_template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta_rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
