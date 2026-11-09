"""WhatsApp Commerce runtime: catalog / collection messages, orders placed from a WhatsApp cart, and the Checkout Bot.

Message shapes follow Meta's catalog docs:
- catalog message: interactive {type: catalog_message, body, footer?, action: {name: catalog_message, parameters?: {thumbnail_product_retailer_id}}}
- multi-product message: interactive {type: product_list, header: {type: text}, body, footer?, action: {catalog_id, sections: [{title, product_items}]}}
  (max 30 products in total)
- inbound order: message {type: order, order: {catalog_id, text?, product_items: [{product_retailer_id, quantity, item_price, currency}]}}

Checkout Bot (when `checkout_live`): order received -> "proceed?" buttons -> name -> address (if `collect_address`) -> payment
choice (COD / online via a Razorpay payment link) -> order placed. Progress lives on the order (`checkout_state`).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.commerce import CommerceSettings, Order, Product
from app.models.contact import Contact
from app.models.conversation import Conversation, Message
from app.models.whatsapp_account import WhatsAppAccount
from app.services import outbound_webhooks, payment_links
from app.services.whatsapp import messaging

log = logging.getLogger(__name__)

MAX_LIST_PRODUCTS = 30
DEFAULTS = {
    "catalog_message_body": "Browse our catalog and add what you like to your cart 🛒",
    "catalog_message_footer": "",
    "catalog_thumbnail_sku": "",
    "collections": [],  # [{id, title, header, body, skus: [..]}]
}


class CommerceError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def cfg(s: CommerceSettings | None) -> dict:
    from app.api.commerce import DEFAULT_CONFIG  # the checkout-bot defaults live with the API
    return {**DEFAULT_CONFIG, **DEFAULTS, **((s.config if s else None) or {})}


def money(minor: int, currency: str = "INR") -> str:
    symbol = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(currency.upper())
    value = f"{minor / 100:,.2f}"
    return f"{symbol}{value}" if symbol else f"{value} {currency.upper()}"


# ---- outbound catalog messages ---------------------------------------------------------------------------------------

def catalog_interactive(c: dict) -> dict:
    body = (c.get("catalog_message_body") or DEFAULTS["catalog_message_body"]).strip()[:1024]
    out: dict[str, Any] = {"type": "catalog_message", "body": {"text": body}, "action": {"name": "catalog_message"}}
    if (c.get("catalog_thumbnail_sku") or "").strip():
        out["action"]["parameters"] = {"thumbnail_product_retailer_id": c["catalog_thumbnail_sku"].strip()}
    if (c.get("catalog_message_footer") or "").strip():
        out["footer"] = {"text": c["catalog_message_footer"].strip()[:60]}
    return out


def collection_interactive(catalog_id: str, collection: dict) -> dict:
    skus = [str(s).strip() for s in collection.get("skus") or [] if str(s).strip()][:MAX_LIST_PRODUCTS]
    if not skus:
        raise CommerceError(f"Collection “{collection.get('title') or 'Untitled'}” has no products.")
    title = (collection.get("title") or "Products").strip()[:24]
    return {
        "type": "product_list",
        "header": {"type": "text", "text": (collection.get("header") or title).strip()[:60]},
        "body": {"text": (collection.get("body") or f"Here are our {title}. Tap to view and add to cart.").strip()[:1024]},
        "action": {"catalog_id": catalog_id, "sections": [{"title": title, "product_items": [{"product_retailer_id": s} for s in skus]}]},
    }


async def settings_for(db: AsyncSession, tenant_id: uuid.UUID) -> CommerceSettings | None:
    return await db.get(CommerceSettings, tenant_id)


async def build_attachment(db: AsyncSession, tenant_id: uuid.UUID, attachment: dict) -> dict:
    """Turn {"type": "catalog"} / {"type": "collection", "collection_id"} into an interactive payload."""
    s = await settings_for(db, tenant_id)
    if s is None or not s.meta_catalog_id:
        raise CommerceError("Connect a Meta catalog in Commerce Settings first.")
    c = cfg(s)
    if attachment.get("type") == "catalog":
        return catalog_interactive(c)
    if attachment.get("type") == "collection":
        col = next((x for x in c.get("collections") or [] if x.get("id") == attachment.get("collection_id")), None)
        if col is None:
            raise CommerceError("That collection no longer exists.", 404)
        return collection_interactive(s.meta_catalog_id, col)
    raise CommerceError("Unknown attachment type.")


async def send_attachment(db: AsyncSession, account: WhatsAppAccount, conv: Conversation, contact: Contact, attachment: dict, *,
                          sender_type: str = "agent", sender_user_id: uuid.UUID | None = None, marker: str | None = None,
                          strict: bool = True) -> Message:
    interactive = await build_attachment(db, account.tenant_id, attachment)
    preview = "🛍️ Catalog" if attachment.get("type") == "catalog" else f"🛍️ {interactive['header']['text']}"
    return await messaging.send_message(db, account, conv, contact, kind="interactive", text=preview, interactive=interactive,
                                        sender_type=sender_type, sender_user_id=sender_user_id,
                                        extra_payload={"auto": marker} if marker else None, strict=strict)


# ---- inbound orders --------------------------------------------------------------------------------------------------

async def _next_order_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    count = (await db.execute(select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id))).scalar_one()
    return f"ORD-{1001 + count}"


async def create_order_from_cart(db: AsyncSession, account: WhatsAppAccount, conv: Conversation, contact: Contact, order: dict) -> Order:
    """Record an order sent from a WhatsApp cart. Prices come from our product list when the SKU is known (minor units);
    otherwise Meta's `item_price` (a decimal in the currency's major unit) is used."""
    items_in = order.get("product_items") or []
    skus = [str(i.get("product_retailer_id") or "") for i in items_in]
    products = {p.retailer_id: p for p in (await db.execute(select(Product).where(Product.tenant_id == account.tenant_id, Product.retailer_id.in_(skus)))).scalars()}
    items, subtotal, currency = [], 0, None
    for it in items_in:
        sku = str(it.get("product_retailer_id") or "")
        qty = max(1, int(it.get("quantity") or 1))
        p = products.get(sku)
        price = p.price if p else round(float(it.get("item_price") or 0) * 100)
        currency = currency or (p.currency if p else str(it.get("currency") or "INR").upper())
        items.append({"product_id": str(p.id) if p else None, "retailer_id": sku, "name": p.name if p else sku, "price": price, "quantity": qty})
        subtotal += price * qty
    o = Order(tenant_id=account.tenant_id, order_number=await _next_order_number(db, account.tenant_id), contact_id=contact.id,
              conversation_id=conv.id, customer_name=None if (contact.name or "").startswith("+") else contact.name, customer_phone=contact.phone,
              items=items, subtotal=subtotal, total=subtotal, currency=currency or "INR", status="pending", payment_status="unpaid",
              note=(order.get("text") or None), source="whatsapp")
    db.add(o)
    await db.flush()
    return o


def _cart_summary(o: Order) -> str:
    lines = [f"• {i['name']} × {i['quantity']} — {money(i['price'] * i['quantity'], o.currency)}" for i in o.items]
    return "\n".join(lines)


def _fill(text: str, o: Order) -> str:
    name = o.customer_name or "there"
    return (text or "").replace("{total_order_value}", money(o.total, o.currency)).replace("{{1}}", name).replace("{order_number}", o.order_number)


async def _say(db, account, conv, contact, text: str, buttons: list[tuple[str, str]] | None = None) -> None:
    try:
        if buttons:
            inter = messaging.buttons_interactive(text[:1024], [{"id": i, "title": t} for i, t in buttons])
            await messaging.send_message(db, account, conv, contact, kind="interactive", text=text, interactive=inter, sender_type="bot",
                                         extra_payload={"auto": "checkout"}, strict=False)
        else:
            await messaging.send_message(db, account, conv, contact, kind="text", text=text, sender_type="bot", extra_payload={"auto": "checkout"}, strict=False)
    except messaging.SendBlocked as exc:
        log.info("checkout message blocked: %s", exc.message)


async def handle_order_message(db: AsyncSession, account: WhatsAppAccount, conv: Conversation, contact: Contact, msg: Message) -> Order | None:
    order_data = (msg.payload or {}).get("order") or {}
    if not order_data.get("product_items"):
        return None
    o = await create_order_from_cart(db, account, conv, contact, order_data)
    s = await settings_for(db, account.tenant_id)
    c = cfg(s)
    live = bool(c.get("checkout_live"))
    if live:
        o.checkout_state = {"step": "proceed"}
    await db.commit()
    await outbound_webhooks.emit(account.tenant_id, "order_received", {"order_id": str(o.id), "order_number": o.order_number, "total": o.total,
                                                                      "currency": o.currency, "phone": contact.phone})
    if live:
        await _say(db, account, conv, contact, f"{_cart_summary(o)}\n\n{_fill(c['proceed_message'], o)}", [("co_yes", "Yes, proceed"), ("co_no", "Cancel order")])
    return o


async def active_checkout(db: AsyncSession, contact_id: uuid.UUID) -> Order | None:
    return (await db.execute(select(Order).where(Order.contact_id == contact_id, Order.checkout_state.is_not(None), Order.status == "pending")
                             .order_by(Order.created_at.desc()).limit(1))).scalar_one_or_none()


def _answer(msg: Message) -> tuple[str, str]:
    """(reply_id, text) for a text / button / list answer."""
    p = msg.payload or {}
    return str(p.get("reply_id") or ""), (msg.body or "").strip()


async def advance_checkout(db: AsyncSession, account: WhatsAppAccount, conv: Conversation, contact: Contact, o: Order, msg: Message) -> bool:
    """Move the Checkout Bot one step on the contact's reply. Returns False when the message isn't an answer (e.g. a reaction)."""
    if msg.type not in {"text", "interactive", "button"}:
        return False
    s = await settings_for(db, account.tenant_id)
    c = cfg(s)
    rid, text = _answer(msg)
    state = dict(o.checkout_state or {})
    step = state.get("step")

    async def finish(payment_method: str, extra: str = "") -> None:
        o.payment_method = payment_method
        o.status = "confirmed" if payment_method == "cod" else "pending"
        o.checkout_state = None
        await db.commit()
        await _say(db, account, conv, contact, _fill(c["order_placed_message"], o) + (f"\n\n{extra}" if extra else ""))
        await outbound_webhooks.emit(account.tenant_id, "order_placed", {"order_id": str(o.id), "order_number": o.order_number, "payment_method": payment_method})

    async def ask_payment() -> None:
        state["step"] = "payment"
        o.checkout_state = state
        await db.commit()
        mode = c.get("payment_mode", "cod")
        if mode == "online":
            buttons = [("co_pay_online", "Pay online")]
        elif mode == "both":
            buttons = [("co_pay_cod", "Cash on delivery"), ("co_pay_online", "Pay online")]
        else:
            buttons = [("co_pay_cod", "Confirm order")]
        await _say(db, account, conv, contact, _fill(c["payment_message"], o) or "How would you like to pay?", buttons)

    lowered = text.lower()
    if step == "proceed":
        if rid == "co_no" or lowered in {"no", "cancel"}:
            o.status, o.checkout_state = "cancelled", None
            await db.commit()
            await _say(db, account, conv, contact, "No problem — your order has been cancelled. Send your cart again any time.")
            return True
        if rid == "co_yes" or lowered in {"yes", "y", "ok", "proceed"}:
            state["step"] = "name"
            o.checkout_state = state
            await db.commit()
            await _say(db, account, conv, contact, _fill(c["address_message"], o) or "Please share your full name.")
            return True
        await _say(db, account, conv, contact, "Please tap “Yes, proceed” to continue or “Cancel order”.", [("co_yes", "Yes, proceed"), ("co_no", "Cancel order")])
        return True
    if step == "name":
        if not text:
            return False
        o.customer_name = text[:200]
        if c.get("collect_address", True):
            state["step"] = "address"
            o.checkout_state = state
            await db.commit()
            await _say(db, account, conv, contact, "Thanks! Now please send your full delivery address with PIN code.")
            return True
        await ask_payment()
        return True
    if step == "address":
        if not text:
            return False
        o.shipping_address = {"text": text[:1000]}
        flag_modified(o, "shipping_address")
        await ask_payment()
        return True
    if step == "payment":
        mode = c.get("payment_mode", "cod")
        wants_online = rid == "co_pay_online" or (mode == "online" and lowered in {"yes", "pay", "ok"})
        wants_cod = rid == "co_pay_cod" or (mode in {"cod", "both"} and lowered in {"yes", "cod", "confirm", "ok"})
        if wants_online and mode in {"online", "both"}:
            try:
                link = await payment_links.create(db, account.tenant_id, None, amount=o.total, currency=o.currency, description=f"Order {o.order_number}",
                                                  contact_id=contact.id, deal_id=None)
            except payment_links.LinkError as exc:
                log.warning("checkout payment link failed for %s: %s", o.order_number, exc)
                await _say(db, account, conv, contact, "Sorry, online payment isn't available right now. Reply COD to pay cash on delivery, or try again later.")
                return True
            o.note = ((o.note or "") + f"\nPayment link: {link.short_url}").strip()
            await finish("razorpay", f"Pay {money(o.total, o.currency)} here: {link.short_url}")
            return True
        if wants_cod:
            await finish("cod")
            return True
        await ask_payment()
        return True
    o.checkout_state = None
    await db.commit()
    return False


async def mark_order_paid_for_link(db: AsyncSession, link_id: uuid.UUID, tenant_id: uuid.UUID, short_url: str | None) -> None:
    """A checkout payment link was paid: mark its order paid + confirmed."""
    if not short_url:
        return
    o = (await db.execute(select(Order).where(Order.tenant_id == tenant_id, Order.note.contains(short_url)).limit(1))).scalar_one_or_none()
    if o is not None and o.payment_status != "paid":
        o.payment_status, o.status = "paid", "confirmed" if o.status == "pending" else o.status
        await db.commit()
