"""WhatsApp Commerce: pushing the product catalog to a Meta catalog via items_batch."""

from __future__ import annotations

import httpx


async def _enable(wsa, catalog_id: str | None = "1234567890"):
    r = await wsa.put("/commerce/settings", json={"meta_catalog_id": catalog_id or "", "catalog_enabled": True})
    assert r.status_code == 200, r.text


async def test_sync_requires_a_catalog_id(wsa):
    await _enable(wsa, None)
    r = await wsa.post("/commerce/products/sync")
    assert r.status_code == 400 and "catalog id" in r.json()["detail"]["error"].lower()


async def test_sync_pushes_visible_products_and_removes_hidden_ones(wsa, meta):
    await _enable(wsa)
    shown = (await wsa.post("/commerce/products", json={"name": "Blue Tee", "price": 49900, "image_url": "https://x.test/a.png", "retailer_id": "TEE-1"})).json()
    hidden = (await wsa.post("/commerce/products", json={"name": "Old Hat", "price": 1000, "image_url": "https://x.test/b.png", "retailer_id": "HAT-1"})).json()

    meta.calls.clear()
    r = await wsa.post("/commerce/products/sync")
    assert r.status_code == 200, r.text
    assert r.json()["synced"] >= 2

    batch = [c for c in meta.calls if c["path"].endswith("/items_batch")]
    assert batch and "/1234567890/" in batch[0]["path"]
    sent = {x["data"]["id"]: x for x in batch[0]["body"]["requests"]}
    assert sent["TEE-1"]["method"] == "UPDATE"
    assert sent["TEE-1"]["data"]["price"] == "499.00 INR"
    assert sent["TEE-1"]["data"]["availability"] == "in stock"
    assert any(p["id"] == shown["id"] and p["synced"] for p in (await wsa.get("/commerce/products")).json())

    # Hide a synced product -> next sync deletes it from Meta.
    await wsa.patch(f"/commerce/products/{hidden['id']}", json={"is_visible": False})
    meta.calls.clear()
    r = await wsa.post("/commerce/products/sync")
    assert r.status_code == 200 and r.json()["removed"] == 1
    sent = {x["data"]["id"]: x for x in [c for c in meta.calls if c["path"].endswith("/items_batch")][0]["body"]["requests"]}
    assert sent["HAT-1"]["method"] == "DELETE"


async def test_sync_rejects_products_without_an_image(wsa):
    await _enable(wsa)
    await wsa.post("/commerce/products", json={"name": "No Image Mug", "price": 2500, "retailer_id": "MUG-1"})
    r = await wsa.post("/commerce/products/sync")
    assert r.status_code == 422 and "No Image Mug" in r.json()["detail"]["error"]


async def test_sync_reports_items_meta_rejected(wsa, meta):
    await _enable(wsa)
    await wsa.post("/commerce/products", json={"name": "Bad Lamp", "price": 9900, "image_url": "https://x.test/l.png", "retailer_id": "LAMP-1"})

    def override(request):
        if request.url.path.endswith("/items_batch"):
            return httpx.Response(200, json={"handles": ["h"], "validation_status": [{"retailer_id": "LAMP-1", "errors": [{"message": "Invalid image"}]}]})
        return None
    meta.override = override
    try:
        r = await wsa.post("/commerce/products/sync")
    finally:
        meta.override = None
    assert r.status_code == 200, r.text
    assert {"retailer_id": "LAMP-1", "name": "Bad Lamp", "error": "Invalid image"} in r.json()["errors"]
    lamp = next(p for p in (await wsa.get("/commerce/products")).json() if p["retailer_id"] == "LAMP-1")
    assert lamp["synced"] is False


async def test_deleting_a_synced_product_removes_it_from_meta(wsa, meta):
    await _enable(wsa)
    p = (await wsa.post("/commerce/products", json={"name": "Cap", "price": 500, "image_url": "https://x.test/c.png", "retailer_id": "CAP-1"})).json()
    assert (await wsa.post("/commerce/products/sync")).status_code == 200
    meta.calls.clear()
    assert (await wsa.delete(f"/commerce/products/{p['id']}")).status_code == 204
    batch = [c for c in meta.calls if c["path"].endswith("/items_batch")]
    assert batch and batch[0]["body"]["requests"] == [{"method": "DELETE", "data": {"id": "CAP-1"}}]


async def test_pull_imports_products_from_the_meta_catalog(wsa, meta):
    await _enable(wsa, "555000111")
    await wsa.post("/commerce/products", json={"name": "Old name", "price": 100, "retailer_id": "TFG-DEMO-001"})
    page2 = "https://graph.facebook.com/v21.0/555000111/products?after=abc"

    def override(request):
        if request.url.path.endswith("/555000111/products"):
            if request.url.params.get("after"):
                return httpx.Response(200, json={"data": [{"id": "9002", "retailer_id": "TFG-DEMO-002", "name": "Watch", "price": "₹2,499.00",
                                                           "currency": "INR", "availability": "out of stock", "image_url": "https://x.test/w.png"}]})
            return httpx.Response(200, json={"data": [
                {"id": "9001", "retailer_id": "TFG-DEMO-001", "name": "Headphones", "price": "₹1,499.00", "currency": "INR",
                 "availability": "in stock", "image_url": "https://x.test/h.png", "product_type": "Audio", "visibility": "published"},
                {"id": "9003", "name": "No SKU", "price": "₹10.00"},
            ], "paging": {"next": page2}})
        return None
    meta.override = override
    try:
        r = await wsa.post("/commerce/products/pull")
    finally:
        meta.override = None
    assert r.status_code == 200, r.text
    assert r.json() == {"added": 1, "updated": 1, "skipped": 1, "total": 3}
    by_sku = {p["retailer_id"]: p for p in (await wsa.get("/commerce/products")).json()}
    assert by_sku["TFG-DEMO-001"]["name"] == "Headphones" and by_sku["TFG-DEMO-001"]["price"] == 149900 and by_sku["TFG-DEMO-001"]["synced"]
    assert by_sku["TFG-DEMO-001"]["category"] == "Audio"
    assert by_sku["TFG-DEMO-002"]["price"] == 249900 and by_sku["TFG-DEMO-002"]["availability"] == "out_of_stock"


async def test_pull_explains_missing_catalog_access(wsa, meta):
    await _enable(wsa, "555000222")

    def override(request):
        if "/555000222/" in request.url.path:
            return httpx.Response(400, json={"error": {"message": "Unsupported get request.", "code": 100, "error_subcode": 33}})
        return None
    meta.override = override
    try:
        r = await wsa.post("/commerce/products/pull")
    finally:
        meta.override = None
    assert r.status_code == 502 and "access to the catalog" in r.json()["detail"]["error"]
