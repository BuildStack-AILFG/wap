"""
Test harness: a real Postgres (TEST_DATABASE_URL, default the docker container on :55432), the real FastAPI app over an ASGI
transport, and a fake Meta Graph API behind httpx.MockTransport so every WhatsApp path runs without network access.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
import sys
import uuid
from pathlib import Path

os.environ.setdefault("ENVIRONMENT", "test")
DB = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:55432/wa_test")
os.environ["DATABASE_URL"] = DB.replace("postgresql://", "postgresql+asyncpg://")
os.environ["DATABASE_URL_SYNC"] = DB.replace("postgresql://", "postgresql+psycopg://")
os.environ.update(JWT_SECRET="test-jwt", REFRESH_TOKEN_SECRET="test-refresh", ENCRYPTION_KEY="test-encryption-key", SCHEDULER_ENABLED="false",
                  PUBLIC_BASE_URL="https://api.test", FRONTEND_URL="https://app.test", BROADCAST_SEND_DELAY_MS="0", META_WEBHOOK_VERIFY_TOKEN="platform-verify",
                  META_APP_SECRET="", CORS_ORIGINS="https://app.test")

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core import ratelimit  # noqa: E402
from app.services.whatsapp import graph  # noqa: E402

APP_SECRET = "test-app-secret"


def pytest_sessionstart(session):  # noqa: ARG001
    """Fresh schema + migrations + plan seed, once per run."""
    env = {**os.environ}
    import sqlalchemy as sa
    eng = sa.create_engine(env["DATABASE_URL_SYNC"])
    with eng.begin() as c:
        c.execute(sa.text("DROP SCHEMA public CASCADE"))
        c.execute(sa.text("CREATE SCHEMA public"))
    eng.dispose()
    for cmd in ([sys.executable, "-m", "alembic", "upgrade", "head"], [sys.executable, "scripts/seed_plans.py"]):
        subprocess.run(cmd, cwd=ROOT, env=env, check=True, capture_output=True)


def pytest_collection_modifyitems(items):
    """Run every async test on the one session-wide loop, so the shared SQLAlchemy engine's connections stay valid."""
    import inspect
    for item in items:
        if inspect.iscoroutinefunction(getattr(item, "function", None)):
            item.add_marker(pytest.mark.asyncio(loop_scope="session"), append=False)


class FakeMeta:
    """Stands in for graph.facebook.com. Records every call; supports failure injection and canned template lists."""

    def __init__(self):
        self.calls: list[dict] = []
        self.sent: list[dict] = []          # POST /messages bodies
        self.templates: list[dict] = []      # what GET /message_templates returns
        self.fail_queue: list[tuple[int, dict]] = []
        self.token = "good-token-" + "x" * 20
        self.valid_tokens = {self.token}
        self.override = None  # optional callable(request) -> httpx.Response | None, consulted first
        self.phone_info = {"display_phone_number": "+91 98765 43210", "verified_name": "Acme", "quality_rating": "GREEN", "name_status": "APPROVED", "messaging_limit_tier": "TIER_1K"}
        self.template_status = "PENDING"
        self._n = 0
        self.media: dict[str, tuple[bytes, str]] = {}

    def fail_next(self, status: int, code: int, message: str = "boom") -> None:
        self.fail_queue.append((status, {"error": {"message": message, "code": code}}))

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = {}
        if request.content and request.headers.get("content-type", "").startswith("application/json"):
            body = json.loads(request.content)
        self.calls.append({"method": request.method, "path": path, "body": body, "params": dict(request.url.params)})
        if self.override is not None and (forced := self.override(request)) is not None:
            return forced
        token = request.headers.get("authorization", "").replace("Bearer ", "").replace("OAuth ", "")
        if token not in self.valid_tokens:
            return httpx.Response(401, json={"error": {"message": "Invalid OAuth access token.", "code": 190}})
        if self.fail_queue and request.method == "POST" and path.endswith("/messages"):
            status, payload = self.fail_queue.pop(0)
            return httpx.Response(status, json=payload)

        m = re.match(r"^/v[\d.]+/(.*)$", path)
        rest = m.group(1) if m else path.lstrip("/")
        if request.method == "POST" and rest.endswith("/messages"):
            if body.get("status") == "read":
                return httpx.Response(200, json={"success": True})
            self._n += 1
            wamid = f"wamid.FAKE{self._n:05d}"
            self.sent.append({"phone_number_id": rest.split("/")[0], "_wamid": wamid, **body})
            return httpx.Response(200, json={"messaging_product": "whatsapp", "contacts": [{"wa_id": body.get("to")}], "messages": [{"id": wamid}]})
        if request.method == "POST" and rest.endswith("/media"):
            self._n += 1
            return httpx.Response(200, json={"id": f"media{self._n}"})
        if request.method == "GET" and request.url.host == "lookaside.fbsbx.com":  # the CDN download (must be checked before the metadata route)
            return httpx.Response(200, content=b"\x89PNGDATA", headers={"content-type": "image/png"})
        if request.method == "GET" and re.fullmatch(r"media\w+", rest):
            data, mime = self.media.get(rest, (b"binary", "image/png"))
            return httpx.Response(200, json={"url": f"https://lookaside.fbsbx.com/{rest}", "mime_type": mime})
        if request.method == "POST" and rest.endswith("/subscribed_apps"):
            return httpx.Response(200, json={"success": True})
        if request.method == "GET" and rest.endswith("/message_templates"):
            return httpx.Response(200, json={"data": self.templates})
        if request.method == "POST" and rest.endswith("/message_templates"):
            self._n += 1
            return httpx.Response(200, json={"id": f"tpl{self._n}", "status": self.template_status, "category": body.get("category")})
        if request.method == "DELETE" and rest.endswith("/message_templates"):
            return httpx.Response(200, json={"success": True})
        if request.method == "GET" and re.fullmatch(r"\d+", rest):
            return httpx.Response(200, json={"id": rest, **self.phone_info})
        return httpx.Response(404, json={"error": {"message": f"unhandled fake route {request.method} {path}", "code": 100}})


@pytest.fixture(scope="session")
def meta() -> FakeMeta:
    fake = FakeMeta()
    client = httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
    graph._http_factory = lambda: client
    return fake


@pytest_asyncio.fixture(scope="session")
async def app_client(meta):  # noqa: ARG001 — meta must be installed first
    from app.main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="https://api.test") as c:
        yield c


@pytest.fixture(autouse=True)
def _reset(meta):
    ratelimit.reset()
    meta.calls.clear()
    meta.sent.clear()
    meta.fail_queue.clear()
    meta.templates.clear()
    meta.template_status = "PENDING"
    meta.override = None


def sign(body: bytes, secret: str = APP_SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class Workspace:
    """A registered tenant with a logged-in owner, plus helpers to drive the API."""

    def __init__(self, client: httpx.AsyncClient, data: dict):
        self.client = client
        self.email = data["email"]
        self.tenant_id = data["workspace"]["id"]
        self.user_id = data["user_id"]
        self.token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self.account: dict | None = None
        self.phone_number_id: str | None = None

    @property
    def h(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def get(self, path, **kw):
        return await self.client.get(f"/api{path}", headers=self.h, **kw)

    async def post(self, path, **kw):
        return await self.client.post(f"/api{path}", headers=self.h, **kw)

    async def put(self, path, **kw):
        return await self.client.put(f"/api{path}", headers=self.h, **kw)

    async def patch(self, path, **kw):
        return await self.client.patch(f"/api{path}", headers=self.h, **kw)

    async def delete(self, path, **kw):
        return await self.client.delete(f"/api{path}", headers=self.h, **kw)

    async def connect(self, meta: FakeMeta) -> dict:
        """Connect a WhatsApp number through the real endpoint (validated against the fake Meta)."""
        self.phone_number_id = "1" + str(secrets.randbelow(10**12)).zfill(12)
        token = meta.token
        r = await self.post("/whatsapp/accounts", json={"waba_id": "9" + str(secrets.randbelow(10**12)).zfill(12), "phone_number_id": self.phone_number_id, "access_token": token, "app_secret": APP_SECRET})
        assert r.status_code == 201, r.text
        self.account = r.json()
        return self.account

    async def inbound(self, text: str = "hi", *, from_: str = "919811112222", name: str = "Asha", wamid: str | None = None, extra: dict | None = None, msg_type: str = "text") -> httpx.Response:
        """Deliver a signed inbound WhatsApp message to this workspace's webhook."""
        assert self.account and self.phone_number_id
        m = {"from": from_, "id": wamid or f"wamid.IN{uuid.uuid4().hex[:12]}", "timestamp": str(int(__import__('time').time())), "type": msg_type}
        m.update(extra or {"text": {"body": text}})
        return await self.webhook({"object": "whatsapp_business_account", "entry": [{"id": self.account["waba_id"], "changes": [{"field": "messages", "value": {
            "messaging_product": "whatsapp", "metadata": {"display_phone_number": "919876543210", "phone_number_id": self.phone_number_id},
            "contacts": [{"profile": {"name": name}, "wa_id": from_}], "messages": [m]}}]}]})

    async def status(self, wamid: str, status: str, recipient: str = "919811112222", errors: list | None = None) -> httpx.Response:
        s = {"id": wamid, "status": status, "timestamp": str(int(__import__('time').time())), "recipient_id": recipient}
        if errors:
            s["errors"] = errors
        return await self.webhook({"object": "whatsapp_business_account", "entry": [{"id": self.account["waba_id"], "changes": [{"field": "messages", "value": {
            "messaging_product": "whatsapp", "metadata": {"phone_number_id": self.phone_number_id}, "statuses": [s]}}]}]})

    async def webhook(self, payload: dict, *, key: str | None = None, signature: str | None = None) -> httpx.Response:
        raw = json.dumps(payload).encode()
        return await self.client.post(f"/api/webhooks/whatsapp/{key or self.account['webhook_url'].rsplit('/', 1)[1]}", content=raw,
                                      headers={"content-type": "application/json", "x-hub-signature-256": signature or sign(raw)})


_counter = 0


@pytest_asyncio.fixture
async def ws(app_client) -> Workspace:
    global _counter
    _counter += 1
    email = f"owner{_counter}-{uuid.uuid4().hex[:6]}@example.com"
    r = await app_client.post("/api/auth/register", json={"company_name": f"Acme {_counter}", "full_name": "Owner", "email": email, "password": "Str0ng!Passw0rd#42"})
    assert r.status_code == 201, r.text
    return Workspace(app_client, r.json())


@pytest_asyncio.fixture
async def wsa(ws, meta) -> Workspace:
    """Workspace with a connected WhatsApp number."""
    await ws.connect(meta)
    return ws


@pytest_asyncio.fixture
async def other(app_client) -> Workspace:
    global _counter
    _counter += 1
    r = await app_client.post("/api/auth/register", json={"company_name": f"Other {_counter}", "email": f"other{_counter}-{uuid.uuid4().hex[:6]}@example.com", "password": "Str0ng!Passw0rd#42"})
    return Workspace(app_client, r.json())


async def db_session():
    from app.db import session as s
    return s.async_session_factory()


def approved_template(name: str = "promo_offer", body: str = "Hi {{1}}, enjoy {{2}} off!", category: str = "MARKETING") -> dict:
    """A template as Meta returns it from GET /message_templates (approved)."""
    return {"id": f"meta_{name}", "name": name, "language": "en", "status": "APPROVED", "category": category,
            "components": [{"type": "BODY", "text": body, "example": {"body_text": [["Asha", "10%"]]}}]}


def wamid_for(meta: FakeMeta, phone: str) -> str:
    """The wamid Meta issued for the most recent message sent to `phone`."""
    return next(m["_wamid"] for m in reversed(meta.sent) if m["to"] == phone)
