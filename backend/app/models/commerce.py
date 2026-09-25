from __future__ import annotations

import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Prices are stored as integers in the currency's minor unit (paise for INR), matching app/services/plan_catalog.py.


class CommerceSettings(TimestampMixin, Base):
    """One row per workspace: whether the WhatsApp catalog/cart is on, the linked Meta catalog, and the checkout-bot config.

    `checkout_mode` — how an order is completed once the customer taps "Checkout":
      manual   — we just record the order; the team follows up (default, needs no payment setup)
      cod      — cash on delivery
      razorpay — a Razorpay payment link is sent (reuses the workspace's existing billing keys)
      external — redirect to `external_checkout_url`
    `config` holds the Checkout Bot script (welcome message, whether to collect address/email, confirmation text).
    """

    __tablename__ = "commerce_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True)
    catalog_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cart_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    meta_catalog_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    checkout_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    external_checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class Product(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A catalog item. `retailer_id` is the SKU shown to Meta; unique within a workspace when set."""

    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("tenant_id", "retailer_id", name="uq_product_tenant_retailer"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    retailer_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # minor units (paise)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    availability: Mapped[str] = mapped_column(String(16), nullable=False, default="in_stock")  # in_stock|out_of_stock
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    meta_product_id: Mapped[str | None] = mapped_column(String(64), nullable=True)  # set once synced to a Meta catalog


class Order(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An order placed through WhatsApp Commerce (or added manually). `items` is a snapshot list so it survives product edits/deletes:
    [{product_id, retailer_id, name, price, quantity}]. Money fields are minor units."""

    __tablename__ = "commerce_orders"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    order_number: Mapped[str] = mapped_column(String(24), nullable=False)  # e.g. "ORD-1042", unique-ish per tenant
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", index=True)  # pending|confirmed|shipped|delivered|cancelled
    payment_status: Mapped[str] = mapped_column(String(16), nullable=False, default="unpaid")  # unpaid|paid|refunded
    payment_method: Mapped[str | None] = mapped_column(String(24), nullable=True)  # cod|razorpay|external|manual
    shipping_address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="whatsapp")  # whatsapp|manual
