"""Thin async client for the WhatsApp Cloud API (Meta Graph API). No business logic lives here."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)

# Meta error codes worth special handling.
CODE_AUTH = {190, 102, 10, 200}
CODE_RATE_LIMIT = {4, 17, 32, 613, 80007, 130429, 131048, 131056}
CODE_OUTSIDE_WINDOW = 131047
CODE_USER_OPTED_OUT = 131050
CODE_NOT_ON_WHATSAPP = 131026


class GraphError(Exception):
    def __init__(self, message: str, *, status: int = 0, code: int | None = None, subcode: int | None = None, details: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.subcode = subcode
        self.details = details

    @property
    def is_auth_error(self) -> bool:
        return self.code in CODE_AUTH or self.status == 401

    @property
    def is_rate_limited(self) -> bool:
        return self.code in CODE_RATE_LIMIT or self.status == 429

    @property
    def is_transient(self) -> bool:
        return self.is_rate_limited or self.status >= 500 or self.status == 0

    def __str__(self) -> str:
        detail = f" ({self.details})" if self.details and self.details not in self.message else ""
        return f"{self.message}{detail}"


# Tests replace this to route traffic to httpx.MockTransport.
_http_factory: Callable[[], httpx.AsyncClient] | None = None
_shared: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _shared
    if _http_factory is not None:
        return _http_factory()
    if _shared is None or _shared.is_closed:
        _shared = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), limits=httpx.Limits(max_connections=50))
    return _shared


async def close_http() -> None:
    global _shared
    if _shared is not None and not _shared.is_closed:
        await _shared.aclose()
    _shared = None


def _parse_error(resp: httpx.Response) -> GraphError:
    try:
        err = resp.json().get("error", {})
    except Exception:  # noqa: BLE001 — non-JSON error body
        err = {}
    message = err.get("error_user_msg") or err.get("message") or f"WhatsApp API returned HTTP {resp.status_code}"
    details = (err.get("error_data") or {}).get("details")
    return GraphError(message, status=resp.status_code, code=err.get("code"), subcode=err.get("error_subcode"), details=details)


class GraphClient:
    def __init__(self, access_token: str):
        settings = get_settings()
        self.token = access_token
        self.base = f"{settings.graph_api_base.rstrip('/')}/{settings.graph_api_version}"

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    async def _request(self, method: str, path: str, *, retries: int = 2, **kwargs: Any) -> dict:
        url = path if path.startswith("http") else f"{self.base}/{path.lstrip('/')}"
        headers = {**self._headers(), **kwargs.pop("headers", {})}
        last: GraphError | None = None
        for attempt in range(retries + 1):
            try:
                resp = await _http().request(method, url, headers=headers, **kwargs)
            except httpx.HTTPError as exc:
                last = GraphError(f"Could not reach WhatsApp API: {exc.__class__.__name__}", status=0)
            else:
                if resp.status_code < 400:
                    return resp.json() if resp.content else {}
                last = _parse_error(resp)
            # Retry only transient failures (network / 5xx). Rate limits are surfaced so callers can back off.
            if not (last.status >= 500 or last.status == 0) or attempt == retries:
                break
        assert last is not None
        raise last

    # ---- messages ---------------------------------------------------------------------------------------------
    async def send(self, phone_number_id: str, to: str, message: dict) -> str:
        """POST /messages. `message` carries `type` + the type-specific object. Returns the wamid."""
        body = {"messaging_product": "whatsapp", "recipient_type": "individual", "to": to, **message}
        data = await self._request("POST", f"{phone_number_id}/messages", json=body, retries=1)
        try:
            return data["messages"][0]["id"]
        except (KeyError, IndexError):
            raise GraphError("WhatsApp API accepted the request but returned no message id.", status=200)

    async def send_text(self, phone_number_id: str, to: str, text: str, preview_url: bool = True) -> str:
        return await self.send(phone_number_id, to, {"type": "text", "text": {"body": text, "preview_url": preview_url}})

    async def send_template(self, phone_number_id: str, to: str, name: str, language: str, components: list[dict] | None = None) -> str:
        template: dict[str, Any] = {"name": name, "language": {"code": language}}
        if components:
            template["components"] = components
        return await self.send(phone_number_id, to, {"type": "template", "template": template})

    async def send_media(self, phone_number_id: str, to: str, kind: str, *, link: str | None = None, media_id: str | None = None,
                         caption: str | None = None, filename: str | None = None) -> str:
        obj: dict[str, Any] = {"id": media_id} if media_id else {"link": link}
        if caption and kind in {"image", "video", "document"}:
            obj["caption"] = caption
        if filename and kind == "document":
            obj["filename"] = filename
        return await self.send(phone_number_id, to, {"type": kind, kind: obj})

    async def send_interactive(self, phone_number_id: str, to: str, interactive: dict) -> str:
        return await self.send(phone_number_id, to, {"type": "interactive", "interactive": interactive})

    async def mark_read(self, phone_number_id: str, wamid: str) -> None:
        await self._request("POST", f"{phone_number_id}/messages", json={"messaging_product": "whatsapp", "status": "read", "message_id": wamid}, retries=0)

    # ---- media ------------------------------------------------------------------------------------------------
    async def upload_media(self, phone_number_id: str, content: bytes, mime: str, filename: str) -> str:
        data = await self._request(
            "POST", f"{phone_number_id}/media",
            data={"messaging_product": "whatsapp", "type": mime},
            files={"file": (filename, content, mime)},
        )
        return data["id"]

    async def download_media(self, media_id: str) -> tuple[bytes, str]:
        meta = await self._request("GET", media_id)
        url = meta.get("url")
        if not url:
            raise GraphError("Media URL not available (it may have expired).", status=404)
        try:
            resp = await _http().get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise GraphError(f"Could not download media: {exc.__class__.__name__}") from exc
        if resp.status_code >= 400:
            raise _parse_error(resp)
        return resp.content, meta.get("mime_type") or resp.headers.get("content-type", "application/octet-stream")

    # ---- phone number / WABA ---------------------------------------------------------------------------------
    async def get_phone_number(self, phone_number_id: str) -> dict:
        fields = "display_phone_number,verified_name,quality_rating,name_status,messaging_limit_tier,code_verification_status"
        return await self._request("GET", phone_number_id, params={"fields": fields}, retries=1)

    async def list_phone_numbers(self, waba_id: str) -> list[dict]:
        data = await self._request("GET", f"{waba_id}/phone_numbers", params={"fields": "id,display_phone_number,verified_name,quality_rating"})
        return data.get("data", [])

    async def subscribe_app(self, waba_id: str, *, callback_uri: str | None = None, verify_token: str | None = None) -> None:
        body: dict[str, str] = {}
        if callback_uri and verify_token:
            body = {"override_callback_uri": callback_uri, "verify_token": verify_token}
        await self._request("POST", f"{waba_id}/subscribed_apps", data=body or None, retries=1)

    async def register_phone(self, phone_number_id: str, pin: str) -> None:
        await self._request("POST", f"{phone_number_id}/register", json={"messaging_product": "whatsapp", "pin": pin}, retries=0)

    # ---- templates --------------------------------------------------------------------------------------------
    async def list_templates(self, waba_id: str) -> list[dict]:
        fields = "id,name,status,category,language,components,rejected_reason,quality_score"
        out: list[dict] = []
        params: dict[str, Any] | None = {"fields": fields, "limit": 100}
        url: str = f"{waba_id}/message_templates"
        for _ in range(20):  # hard stop: 2000 templates
            data = await self._request("GET", url, params=params)
            out.extend(data.get("data", []))
            nxt = (data.get("paging") or {}).get("next")
            if not nxt:
                break
            url, params = nxt, None
        return out

    async def create_template(self, waba_id: str, *, name: str, language: str, category: str, components: list[dict]) -> dict:
        return await self._request(
            "POST", f"{waba_id}/message_templates",
            json={"name": name, "language": language, "category": category, "components": components}, retries=0,
        )

    async def delete_template(self, waba_id: str, name: str) -> None:
        await self._request("DELETE", f"{waba_id}/message_templates", params={"name": name}, retries=0)

    async def upload_sample_handle(self, app_id: str, content: bytes, mime: str) -> str:
        """Resumable Upload API: returns the `h:` handle Meta requires as a template media example."""
        session = await self._request("POST", f"{app_id}/uploads", params={"file_length": len(content), "file_type": mime}, retries=0)
        session_id = session["id"]
        data = await self._request("POST", session_id, content=content, headers={"Authorization": f"OAuth {self.token}", "file_offset": "0"}, retries=0)
        return data["h"]


async def exchange_code_for_token(code: str) -> str:
    """Embedded Signup: swap the short-lived code for a business token. Uses the platform Meta app."""
    settings = get_settings()
    if not (settings.meta_app_id and settings.meta_app_secret):
        raise GraphError("Embedded Signup is not configured on this server (META_APP_ID / META_APP_SECRET).", status=400)
    base = f"{settings.graph_api_base.rstrip('/')}/{settings.graph_api_version}"
    try:
        resp = await _http().get(f"{base}/oauth/access_token", params={"client_id": settings.meta_app_id, "client_secret": settings.meta_app_secret, "code": code})
    except httpx.HTTPError as exc:
        raise GraphError(f"Could not reach Meta: {exc.__class__.__name__}") from exc
    if resp.status_code >= 400:
        raise _parse_error(resp)
    return resp.json()["access_token"]
