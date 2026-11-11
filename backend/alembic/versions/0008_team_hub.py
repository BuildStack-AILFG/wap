"""Team Hub: salespeople's WhatsApp numbers on memberships, and sales tasks

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-11 18:00:00

`tenant_memberships.whatsapp_phone` lets a team member message the business number and reach the team assistant
(their tasks, leads and deals) instead of the customer bot. `sales_tasks` holds calls / follow-ups / meetings.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenant_memberships", sa.Column("whatsapp_phone", sa.String(32), nullable=True))
    op.add_column("tenant_memberships", sa.Column("assistant_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("tenant_memberships", sa.Column("assistant_state", sa.JSON(), nullable=False, server_default="{}"))
    op.create_index("ix_tenant_memberships_whatsapp_phone", "tenant_memberships", ["tenant_id", "whatsapp_phone"])

    op.create_table(
        "sales_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="call"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(8), nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(16), nullable=False, server_default="dashboard"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sales_tasks_tenant_id", "sales_tasks", ["tenant_id"])
    op.create_index("ix_sales_tasks_contact_id", "sales_tasks", ["contact_id"])
    op.create_index("ix_sales_tasks_owner_due", "sales_tasks", ["tenant_id", "user_id", "status", "due_at"])


def downgrade() -> None:
    op.drop_table("sales_tasks")
    op.drop_index("ix_tenant_memberships_whatsapp_phone", "tenant_memberships")
    op.drop_column("tenant_memberships", "assistant_state")
    op.drop_column("tenant_memberships", "assistant_enabled")
    op.drop_column("tenant_memberships", "whatsapp_phone")
