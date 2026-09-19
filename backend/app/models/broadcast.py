"""Broadcast campaign and its per-recipient delivery rows. See the plan file's system design §4.9."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Broadcast(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "broadcasts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("whatsapp_templates.id"), nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="SET NULL"), nullable=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # draft|scheduled|sending|completed|cancelled|failed
    status: Mapped[str] = mapped_column(String(16), default="draft")

    # {type: all_contacts|tag|segment|csv|numbers, tag?, segment_id?}
    audience: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # {body: {"1": {source: field|fixed, value: "name"}}, header: {...}, buttons: {"0": {...}}, fallback: "there"}
    variable_mapping: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent: Mapped[int] = mapped_column(Integer, default=0)
    delivered: Mapped[int] = mapped_column(Integer, default=0)
    read: Mapped[int] = mapped_column(Integer, default=0)
    replied: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)


class BroadcastRecipient(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "broadcast_recipients"
    __table_args__ = (
        Index("ix_broadcast_recipients_broadcast_status", "broadcast_id", "status"),
        Index("ix_broadcast_recipients_wamid", "wamid"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    broadcast_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    variables: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # resolved values per component

    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|sent|delivered|read|failed|skipped
    wamid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
