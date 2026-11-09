"""Commerce runtime: checkout state on orders, catalog attachments on custom replies

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-09 18:00:00

`commerce_orders.checkout_state` tracks where an order placed from a WhatsApp cart is in the Checkout Bot
(e.g. {"step": "name"}); `custom_replies.attachment` lets a keyword reply send the catalog or a collection.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("commerce_orders", sa.Column("checkout_state", sa.JSON(), nullable=True))
    op.add_column("commerce_orders", sa.Column("conversation_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("custom_replies", sa.Column("attachment", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("custom_replies", "attachment")
    op.drop_column("commerce_orders", "conversation_id")
    op.drop_column("commerce_orders", "checkout_state")
