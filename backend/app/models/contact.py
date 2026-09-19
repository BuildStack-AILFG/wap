"""
Contact — unifies the reference product's Lead + Contact split into one row
per (tenant, WhatsApp identity). See the plan file's system design §4.4.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, JSON, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("tenant_id", "phone", name="uq_contacts_tenant_phone"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    custom_fields: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    source: Mapped[str] = mapped_column(String(32), default="manual")  # whatsapp|meta_ads|manual|webhook
    ad_attribution: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    opted_out: Mapped[bool] = mapped_column(Boolean, default=False)
    opted_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
