"""WhatsApp message template, mirrored from / submitted to Meta. See the plan file's system design §4.7."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WhatsAppTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "language", name="uq_templates_tenant_name_language"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="SET NULL"), nullable=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    category: Mapped[str] = mapped_column(String(32), nullable=False)  # MARKETING|UTILITY|AUTHENTICATION
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Rich components. header_type: none|text|image|video|document. buttons: [{type: quick_reply|url|phone|copy_code, text, url?, phone?, example?}]
    header_type: Mapped[str] = mapped_column(String(16), default="none")
    header_text: Mapped[str | None] = mapped_column(String(120), nullable=True)
    header_example: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # sample media URL (Meta requires an example)
    footer: Mapped[str | None] = mapped_column(String(60), nullable=True)
    buttons: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    body_examples: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # one sample per {{n}} variable
    components: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # raw Meta components, as last synced/submitted

    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|pending|approved|rejected|paused|disabled
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    meta_template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta_rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
