"""WhatsApp Commerce: pushing the product catalog to a Meta catalog via items_batch."""

from __future__ import annotations


async def _enable(wsa, catalog_id: str | None = "1234567890"):
    r = await wsa.put("/commerce/settings", json={"meta_catalog_id": catalog_id or "", "catalog_enabled": True})
    assert r.status_code == 200, r.text


async def test_sync_requires_a_catalog_id(wsa):
    await _enable(wsa, None)
    r = await wsa.post("/commerce/products/sync")
    assert r.status_code == 400 and "catalog id" in r.json()["error"].lower()


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
    assert r.status_code == 422 and "No Image Mug" in r.json()["error"]
