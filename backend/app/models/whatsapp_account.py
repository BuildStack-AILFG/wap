"""A connected WhatsApp Business number (WABA + phone number). Credentials are encrypted at rest."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WhatsAppAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_accounts"
    __table_args__ = (UniqueConstraint("phone_number_id", name="uq_whatsapp_accounts_phone_number_id"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    waba_id: Mapped[str] = mapped_column(String(64), nullable=False)
    phone_number_id: Mapped[str] = mapped_column(String(64), nullable=False)
    display_phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    verified_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    quality_rating: Mapped[str | None] = mapped_column(String(16), nullable=True)  # GREEN|YELLOW|RED|UNKNOWN
    messaging_limit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    name_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional: only for tenants running their own Meta app (manual connect). Falls back to the platform META_APP_SECRET.
    app_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Public, unguessable id for the per-account webhook URL + its own verify token.
    webhook_key: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    verify_token: Mapped[str] = mapped_column(String(64), nullable=False)

    connection_type: Mapped[str] = mapped_column(String(16), default="manual")  # manual|embedded
    status: Mapped[str] = mapped_column(String(16), default="connected")  # connected|error|disconnected
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_webhook_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    daily_send_count: Mapped[int] = mapped_column(Integer, default=0)
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
