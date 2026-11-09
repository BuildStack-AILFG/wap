"""WhatsApp Commerce runtime: catalog / collection messages, orders sent from a WhatsApp cart, and the Checkout Bot.
Payload shapes follow Meta's catalog-message, multi-product-message, catalog-template and order-webhook references."""

from __future__ import annotations

CUSTOMER = "919811110001"


async def _setup(wsa, *, live: bool = True, payment_mode: str = "cod", collect_address: bool = True):
    r = await wsa.put("/commerce/settings", json={"meta_catalog_id": "777000111", "catalog_enabled": True, "config": {
        "checkout_live": live, "payment_mode": payment_mode, "collect_address": collect_address,
        "catalog_message_body": "Shop our summer range", "catalog_thumbnail_sku": "TEE-1",
        "collections": [{"id": "tees", "title": "T-shirts", "skus": ["TEE-1", "TEE-2"]}],
    }})
    assert r.status_code == 200, r.text
    for sku, price in (("TEE-1", 49900), ("TEE-2", 59900)):
        await wsa.post("/commerce/products", json={"name": f"Tee {sku[-1]}", "price": price, "retailer_id": sku, "image_url": "https://x.test/t.png"})


def _order(items):
    return {"order": {"catalog_id": "777000111", "text": "please deliver fast",
                      "product_items": [{"product_retailer_id": s, "quantity": q, "item_price": p, "currency": "INR"} for s, q, p in items]}}


def _sent_interactive(meta):
    return [m["interactive"] for m in meta.sent if m["type"] == "interactive"]


async def _orders(wsa):
    return (await wsa.get("/commerce/orders")).json()


async def test_cart_becomes_an_order_and_checkout_bot_completes_it(wsa, meta):
    await _setup(wsa)
    meta.sent.clear()
    r = await wsa.inbound(from_=CUSTOMER, msg_type="order", extra=_order([("TEE-1", 2, 499), ("TEE-2", 1, 599)]))
    assert r.status_code == 200

    [o] = await _orders(wsa)
    assert o["status"] == "pending" and o["checkout_step"] == "proceed" and o["total"] == 2 * 49900 + 59900
    assert [i["retailer_id"] for i in o["items"]] == ["TEE-1", "TEE-2"] and o["note"] == "please deliver fast"
    ask = _sent_interactive(meta)[-1]
    assert ask["type"] == "button" and "₹1,597.00" in ask["body"]["text"]

    await wsa.inbound(from_=CUSTOMER, msg_type="interactive", extra={"interactive": {"type": "button_reply", "button_reply": {"id": "co_yes", "title": "Yes, proceed"}}})
    await wsa.inbound("Asha Verma", from_=CUSTOMER)
    await wsa.inbound("12 MG Road, Bengaluru 560001", from_=CUSTOMER)
    assert (await _orders(wsa))[0]["checkout_step"] == "payment"
    await wsa.inbound(from_=CUSTOMER, msg_type="interactive", extra={"interactive": {"type": "button_reply", "button_reply": {"id": "co_pay_cod", "title": "Confirm order"}}})

    [o] = await _orders(wsa)
    assert o["status"] == "confirmed" and o["payment_method"] == "cod" and o["checkout_step"] is None
    assert o["customer_name"] == "Asha Verma" and o["shipping_address"] == {"text": "12 MG Road, Bengaluru 560001"}
    last = meta.sent[-1]
    assert last["type"] == "text" and "Asha Verma" in last["text"]["body"]


async def test_order_without_live_checkout_is_only_recorded(wsa, meta):
    await _setup(wsa, live=False)
    meta.sent.clear()
    await wsa.inbound(from_=CUSTOMER, msg_type="order", extra=_order([("UNKNOWN-SKU", 1, 250)]))
    [o] = await _orders(wsa)
    assert o["checkout_step"] is None and o["total"] == 25000  # unknown SKU falls back to Meta's item_price (major units)
    assert not _sent_interactive(meta)


async def test_cancelling_at_the_first_step(wsa, meta):
    await _setup(wsa)
    await wsa.inbound(from_=CUSTOMER, msg_type="order", extra=_order([("TEE-1", 1, 499)]))
    await wsa.inbound("no", from_=CUSTOMER)
    [o] = await _orders(wsa)
    assert o["status"] == "cancelled" and o["checkout_step"] is None


async def test_send_catalog_and_collection_into_a_conversation(wsa, meta):
    await _setup(wsa)
    await wsa.inbound("hi", from_=CUSTOMER)
    conv = (await wsa.get("/inbox/conversations")).json()["items"][0]["id"]
    meta.sent.clear()

    assert (await wsa.post("/commerce/send", json={"conversation_id": conv, "type": "catalog"})).status_code == 200
    assert (await wsa.post("/commerce/send", json={"conversation_id": conv, "type": "collection", "collection_id": "tees"})).status_code == 200
    cat, col = _sent_interactive(meta)
    assert cat == {"type": "catalog_message", "body": {"text": "Shop our summer range"},
                   "action": {"name": "catalog_message", "parameters": {"thumbnail_product_retailer_id": "TEE-1"}}}
    assert col["type"] == "product_list" and col["header"] == {"type": "text", "text": "T-shirts"}
    assert col["action"] == {"catalog_id": "777000111", "sections": [{"title": "T-shirts", "product_items": [
        {"product_retailer_id": "TEE-1"}, {"product_retailer_id": "TEE-2"}]}]}

    r = await wsa.post("/commerce/send", json={"conversation_id": conv, "type": "collection", "collection_id": "nope"})
    assert r.status_code == 404


async def test_custom_reply_can_send_the_catalog(wsa, meta):
    await _setup(wsa)
    r = await wsa.post("/custom-replies", json={"trigger": "menu, catalog", "match_type": "contains", "reply_text": "", "attachment": {"type": "catalog"}})
    assert r.status_code == 201, r.text
    meta.sent.clear()
    await wsa.inbound("show me the menu", from_=CUSTOMER)
    assert [i["type"] for i in _sent_interactive(meta)] == ["catalog_message"]


async def test_custom_reply_catalog_needs_a_connected_catalog(wsa):
    r = await wsa.post("/custom-replies", json={"trigger": "menu", "reply_text": "", "attachment": {"type": "catalog"}})
    assert r.status_code == 422 and "catalog" in r.json()["detail"]["error"].lower()


async def test_collections_are_validated(wsa):
    r = await wsa.put("/commerce/settings", json={"config": {"collections": [{"title": "Empty", "skus": []}]}})
    assert r.status_code == 422


async def test_catalog_template_buttons(wsa, meta):
    from app.models.template import WhatsAppTemplate
    from app.services.whatsapp.templates import TemplateValidationError, build_meta_components, build_send_components, validate_template

    kw = dict(name="shop_now", body="New arrivals are here!", header_type="none", header_text=None, footer=None, body_examples=[], header_example=None)
    validate_template(category="MARKETING", buttons=[{"type": "catalog", "text": "x"}], **kw)
    for bad in (dict(category="UTILITY", buttons=[{"type": "catalog"}]),
                dict(category="MARKETING", buttons=[{"type": "catalog"}, {"type": "quick_reply", "text": "Hi"}])):
        try:
            validate_template(**kw, **bad)
        except TemplateValidationError:
            pass
        else:
            raise AssertionError(f"accepted {bad}")

    tpl = WhatsAppTemplate(name="shop_now", category="MARKETING", body="New arrivals are here!", header_type="none", buttons=[{"type": "catalog", "text": "View catalog"}])
    assert build_meta_components(tpl)[-1] == {"type": "BUTTONS", "buttons": [{"type": "CATALOG", "text": "View catalog"}]}
    assert build_send_components(tpl, catalog_thumbnail="TEE-1") == [
        {"type": "button", "sub_type": "CATALOG", "index": 0, "parameters": [{"type": "action", "action": {"thumbnail_product_retailer_id": "TEE-1"}}]}]
