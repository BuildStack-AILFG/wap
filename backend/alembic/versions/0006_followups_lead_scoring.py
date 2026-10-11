"""Follow-up sequences and AI lead scoring

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-12 12:00:00

Adds multi-step follow-up sequences (stopped by the contact's reply) with their per-contact enrollments, and the AI lead
score columns on contacts.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.dialects.postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "followup_sequences",
        sa.Column("id", UUID, nullable=False),
        sa.Column("tenant_id", UUID, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("trigger", sa.String(length=16), nullable=False, server_default="manual"),
        sa.Column("trigger_value", sa.String(length=100), nullable=True),
        sa.Column("steps", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("business_hours_only", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_followup_sequences_tenant_id", "followup_sequences", ["tenant_id"])

    op.create_table(
        "followup_enrollments",
        sa.Column("id", UUID, nullable=False),
        sa.Column("tenant_id", UUID, nullable=False),
        sa.Column("sequence_id", UUID, nullable=False),
        sa.Column("contact_id", UUID, nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("log", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sequence_id"], ["followup_sequences.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_followup_enrollments_tenant_id", "followup_enrollments", ["tenant_id"])
    op.create_index("ix_followup_enrollments_sequence_id", "followup_enrollments", ["sequence_id"])
    op.create_index("ix_followup_enrollments_contact_id", "followup_enrollments", ["contact_id"])
    op.create_index("ix_followup_enrollments_due", "followup_enrollments", ["status", "next_run_at"])
    op.create_index("uq_followup_active_enrollment", "followup_enrollments", ["sequence_id", "contact_id"], unique=True,
                    postgresql_where=sa.text("status = 'active'"))

    op.add_column("contacts", sa.Column("lead_score", sa.String(length=8), nullable=True))
    op.add_column("contacts", sa.Column("lead_score_reason", sa.Text(), nullable=True))
    op.add_column("contacts", sa.Column("lead_scored_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_contacts_lead_score", "contacts", ["lead_score"])


def downgrade() -> None:
    op.drop_index("ix_contacts_lead_score", table_name="contacts")
    op.drop_column("contacts", "lead_scored_at")
    op.drop_column("contacts", "lead_score_reason")
    op.drop_column("contacts", "lead_score")
    op.drop_table("followup_enrollments")
    op.drop_table("followup_sequences")
