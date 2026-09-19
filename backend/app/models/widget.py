"""Website WhatsApp chat widget. `public_key` identifies the widget in the embed snippet and the public endpoints."""

from __future__ import annotations

import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Widget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "widgets"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    public_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Website widget")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")  # digits only, country code included, no '+'
    title: Mapped[str] = mapped_column(String(120), nullable=False, default="Chat with us")
    subtitle: Mapped[str] = mapped_column(String(200), nullable=False, default="Typically replies within minutes")
    welcome_message: Mapped[str] = mapped_column(Text, nullable=False, default="Hi there! How can we help you today?")
    prefill_message: Mapped[str] = mapped_column(String(500), nullable=False, default="Hi, I have a question.")
    cta_text: Mapped[str] = mapped_column(String(60), nullable=False, default="Start chat")
    brand_color: Mapped[str] = mapped_column(String(9), nullable=False, default="#00926B")
    position: Mapped[str] = mapped_column(String(8), nullable=False, default="right")  # left|right
    bottom_offset: Mapped[int] = mapped_column(Integer, default=24)
    delay_seconds: Mapped[int] = mapped_column(Integer, default=0)
    collect_lead: Mapped[bool] = mapped_column(Boolean, default=False)  # ask name + phone first, saved as a contact
    allowed_domains: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # [] = any origin
    opens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    clicks: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    leads: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
