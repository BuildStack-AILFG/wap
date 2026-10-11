from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FollowupSequence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A multi-step follow-up for leads who go quiet. `steps` = [{delay_minutes, kind: template|text|ai, template_id, variables,
    text, instructions, fallback_template_id}], run by app/services/followups.py. A reply from the contact ends the sequence."""

    __tablename__ = "followup_sequences"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    trigger: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")  # manual | tag | new_lead
    trigger_value: Mapped[str | None] = mapped_column(String(100), nullable=True)  # tag name, or lead source ("" = any source)
    steps: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    business_hours_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class FollowupEnrollment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One contact going through one sequence. status: active | replied | completed | stopped | failed."""

    __tablename__ = "followup_enrollments"
    __table_args__ = (
        # a contact can only be in a given sequence once at a time
        Index("uq_followup_active_enrollment", "sequence_id", "contact_id", unique=True, postgresql_where=text("status = 'active'")),
        Index("ix_followup_enrollments_due", "status", "next_run_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("followup_sequences.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")  # what enrolled them: manual | tag | new_lead | recovery
    log: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
