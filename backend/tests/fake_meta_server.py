"""
Standalone fake Meta Graph API for local end-to-end runs (no Meta account needed):

    uvicorn tests.fake_meta_server:app --port 9100
    GRAPH_API_BASE=http://127.0.0.1:9100  # in the backend's environment

Accepts the token "good-token-xxxxxxxxxxxxxxxxxxxx" and mimics phone-number, message, media and template endpoints.
`GET /__sent` lists every message the backend tried to send; `POST /__templates` seeds the template list.
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI, Request, Response

from tests.conftest import FakeMeta

app = FastAPI()
fake = FakeMeta()


@app.get("/__sent")
async def sent() -> list[dict]:
    return fake.sent


@app.post("/__templates")
async def seed_templates(request: Request) -> dict:
    fake.templates[:] = await request.json()
    return {"count": len(fake.templates)}


@app.post("/__template_status")
async def set_template_status(request: Request) -> dict:
    fake.template_status = (await request.json())["status"]
    return {"ok": True}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def anything(path: str, request: Request) -> Response:
    body = await request.body()
    req = httpx.Request(request.method, str(request.url), headers=dict(request.headers), content=body)
    resp = fake.handler(req)
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type", "application/json"))
