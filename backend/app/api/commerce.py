"""WhatsApp Commerce: commerce settings, product catalog and the order panel.

Prices are handled in the currency's minor unit (paise for INR) end to end — the frontend converts to/from a decimal for display.
Meta Catalog sync and live payment collection are deliberately left as marked stubs; the data model and API are complete so they can be
wired to the Graph API / Razorpay later without a schema change.
"""

from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_writer
from app.models.commerce import CommerceSettings, Order, Product

router = APIRouter(prefix="/commerce", tags=["commerce"])

CHECKOUT_MODES = {"manual", "cod", "razorpay", "external"}
AVAILABILITY = {"in_stock", "out_of_stock"}
ORDER_STATUSES = {"pending", "confirmed", "shipped", "delivered", "cancelled"}
PAYMENT_STATUSES = {"unpaid", "paid", "refunded"}

# Default Checkout Bot ("Auto Checkout Flow") script, stored in commerce_settings.config.
DEFAULT_CONFIG = {
    "welcome_message": "Hi! 👋 Browse our catalog and add items to your cart. Reply *checkout* when you're ready.",
    "collect_address": True,
    "collect_email": False,
    "confirmation_message": "Thanks for your order! We've received it and will confirm shortly. 🎉",
    "payment_instructions": "",
    # Auto Checkout Flow
    "checkout_live": False,
    "payment_mode": "cod",  # cod | online | both
    "free_shipping": True,
    "proceed_message": "Thanks for your cart! We currently deliver for free all over India.\nYour total order value = {total_order_value}. Would you like to proceed?",
    "address_message": "Great! We'll need a few details to ship your order. Please share your full name.",
    "payment_message": "We only offer Cash on Delivery right now. Would you like to confirm the order?",
    "order_placed_message": "Your order is placed! 🎉\n\nHey {{1}}, thanks for confirming. We're getting your order ready and will send you updates soon.",
}


# ---- serializers ---------------------------------------------------------------------------------------------------

def _settings_out(s: CommerceSettings) -> dict:
    return {
        "catalog_enabled": s.catalog_enabled,
        "cart_enabled": s.cart_enabled,
        "meta_catalog_id": s.meta_catalog_id,
        "currency": s.currency,
        "checkout_mode": s.checkout_mode,
        "external_checkout_url": s.external_checkout_url,
        "config": {**DEFAULT_CONFIG, **(s.config or {})},
    }


def _product_out(p: Product) -> dict:
    return {
        "id": str(p.id), "retailer_id": p.retailer_id, "name": p.name, "description": p.description,
        "price": p.price, "currency": p.currency, "image_url": p.image_url, "category": p.category,
        "availability": p.availability, "is_visible": p.is_visible, "synced": p.meta_product_id is not None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _order_out(o: Order) -> dict:
    return {
        "id": str(o.id), "order_number": o.order_number, "customer_name": o.customer_name, "customer_phone": o.customer_phone,
        "items": o.items or [], "subtotal": o.subtotal, "total": o.total, "currency": o.currency,
        "status": o.status, "payment_status": o.payment_status, "payment_method": o.payment_method,
        "shipping_address": o.shipping_address, "note": o.note, "source": o.source,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


async def _get_settings(db: AsyncSession, tenant_id: uuid.UUID) -> CommerceSettings:
    s = await db.get(CommerceSettings, tenant_id)
    if s is None:
        s = CommerceSettings(tenant_id=tenant_id, config=dict(DEFAULT_CONFIG))
        db.add(s)
        await db.flush()
    return s


# ---- settings ------------------------------------------------------------------------------------------------------

class SettingsIn(BaseModel):
    catalog_enabled: bool | None = None
    cart_enabled: bool | None = None
    meta_catalog_id: str | None = Field(None, max_length=64)
    currency: str | None = Field(None, min_length=3, max_length=3)
    checkout_mode: str | None = None
    external_checkout_url: str | None = Field(None, max_length=2000)
    config: dict | None = None


@router.get("/settings")
async def get_settings_endpoint(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    s = await _get_settings(db, ctx.tenant_id)
    await db.commit()
    return _settings_out(s)


@router.put("/settings")
async def update_settings(body: SettingsIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    s = await _get_settings(db, ctx.tenant_id)
    if body.checkout_mode is not None and body.checkout_mode not in CHECKOUT_MODES:
        raise HTTPException(status_code=422, detail={"error": f"checkout_mode must be one of {sorted(CHECKOUT_MODES)}."})
    if body.catalog_enabled is not None:
        s.catalog_enabled = body.catalog_enabled
    if body.cart_enabled is not None:
        s.cart_enabled = body.cart_enabled
    if body.meta_catalog_id is not None:
        s.meta_catalog_id = body.meta_catalog_id.strip() or None
    if body.currency is not None:
        s.currency = body.currency.upper()
    if body.checkout_mode is not None:
        s.checkout_mode = body.checkout_mode
    if body.external_checkout_url is not None:
        s.external_checkout_url = body.external_checkout_url.strip() or None
    if body.config is not None:
        s.config = {**DEFAULT_CONFIG, **(s.config or {}), **body.config}
    await db.commit()
    return _settings_out(s)


# ---- products (catalog) --------------------------------------------------------------------------------------------

class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    retailer_id: str | None = Field(None, max_length=80)
    description: str | None = Field(None, max_length=5000)
    price: int = Field(ge=0)  # minor units
    currency: str = Field("INR", min_length=3, max_length=3)
    image_url: str | None = Field(None, max_length=2000)
    category: str | None = Field(None, max_length=120)
    availability: str = "in_stock"
    is_visible: bool = True


class ProductPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    retailer_id: str | None = Field(None, max_length=80)
    description: str | None = Field(None, max_length=5000)
    price: int | None = Field(None, ge=0)
    currency: str | None = Field(None, min_length=3, max_length=3)
    image_url: str | None = Field(None, max_length=2000)
    category: str | None = Field(None, max_length=120)
    availability: str | None = None
    is_visible: bool | None = None


async def _owned_product(db: AsyncSession, ctx: Ctx, product_id: uuid.UUID) -> Product:
    p = await db.get(Product, product_id)
    if p is None or p.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Product not found."})
    return p


@router.get("/products")
async def list_products(
    search: str | None = Query(None),
    availability: str | None = Query(None),
    ctx: Ctx = Depends(get_ctx),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    stmt = select(Product).where(Product.tenant_id == ctx.tenant_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.retailer_id.ilike(like), Product.category.ilike(like)))
    if availability in AVAILABILITY:
        stmt = stmt.where(Product.availability == availability)
    stmt = stmt.order_by(Product.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [_product_out(p) for p in rows]


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    if body.availability not in AVAILABILITY:
        raise HTTPException(status_code=422, detail={"error": "availability must be in_stock or out_of_stock."})
    p = Product(
        tenant_id=ctx.tenant_id, name=body.name.strip(), retailer_id=(body.retailer_id or "").strip() or None,
        description=body.description, price=body.price, currency=body.currency.upper(), image_url=(body.image_url or "").strip() or None,
        category=(body.category or "").strip() or None, availability=body.availability, is_visible=body.is_visible,
    )
    db.add(p)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"error": "A product with that SKU (retailer id) already exists."})
    return _product_out(p)


@router.patch("/products/{product_id}")
async def update_product(product_id: uuid.UUID, body: ProductPatch, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    p = await _owned_product(db, ctx, product_id)
    data = body.model_dump(exclude_unset=True)
    if "availability" in data and data["availability"] not in AVAILABILITY:
        raise HTTPException(status_code=422, detail={"error": "availability must be in_stock or out_of_stock."})
    for field in ("name", "description", "price", "availability", "is_visible"):
        if field in data and data[field] is not None:
            setattr(p, field, data[field].strip() if field == "name" else data[field])
    if "retailer_id" in data:
        p.retailer_id = (data["retailer_id"] or "").strip() or None
    if "image_url" in data:
        p.image_url = (data["image_url"] or "").strip() or None
    if "category" in data:
        p.category = (data["category"] or "").strip() or None
    if data.get("currency"):
        p.currency = data["currency"].upper()
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"error": "A product with that SKU (retailer id) already exists."})
    return _product_out(p)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_product(product_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> None:
    p = await _owned_product(db, ctx, product_id)
    await db.delete(p)
    await db.commit()


@router.post("/products/sync")
async def sync_catalog(ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    """Push the catalog to the linked Meta commerce catalog. Stub: requires META catalog wiring + a connected WABA."""
    s = await _get_settings(db, ctx.tenant_id)
    await db.commit()
    if not s.meta_catalog_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Link a Meta catalog id in Commerce Settings first, then connect it to your WhatsApp number in Meta Commerce Manager."},
        )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"error": "Meta Catalog sync isn't wired yet. Products are stored here and ready to push once the Graph API catalog integration is enabled."},
    )


MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 10_000
_PRICE_KEYS = {"price", "amount", "mrp", "cost", "sale_price"}
_IMAGE_KEYS = {"image_url", "image", "image_link", "imageurl", "photo"}


@router.post("/products/import")
async def import_products(file: UploadFile = File(...), ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    """Bulk-add products from a CSV. Columns (case-insensitive): name, price, retailer_id/sku, description, image_url, category, availability.
    Prices are read as major units (e.g. 499 or 499.00) and stored as minor units. Rows with a blank name are skipped."""
    raw = await file.read()
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail={"error": "CSV is too large (max 5 MB)."})
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail={"error": "Couldn't read the file — please upload a UTF-8 CSV."})
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail={"error": "The CSV has no header row."})
    norm = {(h or "").strip().lower(): h for h in reader.fieldnames}

    def cell(row: dict, *names: str) -> str:
        for n in names:
            if n in norm and row.get(norm[n]) is not None:
                return str(row[norm[n]]).strip()
        return ""

    def price_cell(row: dict) -> int:
        for k in _PRICE_KEYS:
            if k in norm:
                v = str(row.get(norm[k], "")).strip().replace(",", "").replace("₹", "").replace("$", "")
                if v:
                    try:
                        return max(0, round(float(v) * 100))
                    except ValueError:
                        return 0
        return 0

    def image_cell(row: dict) -> str | None:
        for k in _IMAGE_KEYS:
            if k in norm and str(row.get(norm[k], "")).strip():
                return str(row[norm[k]]).strip()
        return None

    added = skipped = 0
    for i, row in enumerate(reader):
        if i >= MAX_IMPORT_ROWS:
            break
        name = cell(row, "name", "title", "product", "product_name")
        if not name:
            skipped += 1
            continue
        avail = cell(row, "availability", "stock").lower()
        db.add(Product(
            tenant_id=ctx.tenant_id, name=name[:200], retailer_id=(cell(row, "retailer_id", "sku", "id") or None),
            description=(cell(row, "description", "desc") or None), price=price_cell(row),
            currency=(cell(row, "currency") or "INR").upper()[:3], image_url=image_cell(row),
            category=(cell(row, "category", "collection") or None),
            availability="out_of_stock" if avail in {"out_of_stock", "out of stock", "0", "no", "false"} else "in_stock",
        ))
        added += 1
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"error": "Some SKUs (retailer ids) in the file already exist. Remove duplicates and try again."})
    return {"added": added, "skipped": skipped}


# ---- orders (order panel) ------------------------------------------------------------------------------------------

class OrderItemIn(BaseModel):
    product_id: str | None = None
    retailer_id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1, le=9999)


class OrderIn(BaseModel):
    customer_name: str | None = Field(None, max_length=200)
    customer_phone: str | None = Field(None, max_length=32)
    items: list[OrderItemIn] = Field(min_length=1)
    currency: str = Field("INR", min_length=3, max_length=3)
    payment_method: str | None = None
    shipping_address: dict | None = None
    note: str | None = Field(None, max_length=2000)


class OrderPatch(BaseModel):
    status: str | None = None
    payment_status: str | None = None
    payment_method: str | None = None
    note: str | None = Field(None, max_length=2000)


async def _owned_order(db: AsyncSession, ctx: Ctx, order_id: uuid.UUID) -> Order:
    o = await db.get(Order, order_id)
    if o is None or o.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail={"error": "Order not found."})
    return o


async def _next_order_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    count = (await db.execute(select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id))).scalar_one()
    return f"ORD-{1001 + int(count)}"


@router.get("/orders")
async def list_orders(
    status_filter: str | None = Query(None, alias="status"),
    ctx: Ctx = Depends(get_ctx),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    stmt = select(Order).where(Order.tenant_id == ctx.tenant_id)
    if status_filter in ORDER_STATUSES:
        stmt = stmt.where(Order.status == status_filter)
    stmt = stmt.order_by(Order.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [_order_out(o) for o in rows]


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(body: OrderIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    items = [i.model_dump() for i in body.items]
    subtotal = sum(i["price"] * i["quantity"] for i in items)
    o = Order(
        tenant_id=ctx.tenant_id, order_number=await _next_order_number(db, ctx.tenant_id),
        customer_name=(body.customer_name or "").strip() or None, customer_phone=(body.customer_phone or "").strip() or None,
        items=items, subtotal=subtotal, total=subtotal, currency=body.currency.upper(),
        payment_method=body.payment_method, shipping_address=body.shipping_address, note=body.note, source="manual",
    )
    db.add(o)
    await db.commit()
    return _order_out(o)


@router.patch("/orders/{order_id}")
async def update_order(order_id: uuid.UUID, body: OrderPatch, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    o = await _owned_order(db, ctx, order_id)
    if body.status is not None:
        if body.status not in ORDER_STATUSES:
            raise HTTPException(status_code=422, detail={"error": f"status must be one of {sorted(ORDER_STATUSES)}."})
        o.status = body.status
    if body.payment_status is not None:
        if body.payment_status not in PAYMENT_STATUSES:
            raise HTTPException(status_code=422, detail={"error": f"payment_status must be one of {sorted(PAYMENT_STATUSES)}."})
        o.payment_status = body.payment_status
    if body.payment_method is not None:
        o.payment_method = body.payment_method or None
    if body.note is not None:
        o.note = body.note or None
    await db.commit()
    return _order_out(o)


# ---- overview stats ------------------------------------------------------------------------------------------------

@router.get("/stats")
async def stats(ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    products_total = (await db.execute(select(func.count()).select_from(Product).where(Product.tenant_id == ctx.tenant_id))).scalar_one()
    orders_total = (await db.execute(select(func.count()).select_from(Order).where(Order.tenant_id == ctx.tenant_id))).scalar_one()
    revenue = (await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(Order.tenant_id == ctx.tenant_id, Order.payment_status == "paid")
    )).scalar_one()
    pending = (await db.execute(
        select(func.count()).select_from(Order).where(Order.tenant_id == ctx.tenant_id, Order.status == "pending")
    )).scalar_one()
    return {"products": int(products_total), "orders": int(orders_total), "paid_revenue": int(revenue), "pending_orders": int(pending)}
