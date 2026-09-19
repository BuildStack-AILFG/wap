"""Template lifecycle: validate -> build Meta components -> submit -> sync status; and build send-time components."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.crypto import decrypt
from app.models.template import WhatsAppTemplate
from app.models.whatsapp_account import WhatsAppAccount
from app.services.whatsapp.graph import GraphClient, GraphError

VAR_RE = re.compile(r"\{\{\s*(\d+)\s*\}\}")
NAME_RE = re.compile(r"^[a-z0-9_]{1,512}$")

MEDIA_HEADERS = {"image", "video", "document"}
MEDIA_MIME_DEFAULT = {"image": "image/jpeg", "video": "video/mp4", "document": "application/pdf"}

# Meta status -> our status
STATUS_MAP = {
    "APPROVED": "approved", "PENDING": "pending", "REJECTED": "rejected", "PAUSED": "paused", "DISABLED": "disabled",
    "IN_APPEAL": "pending", "PENDING_DELETION": "disabled", "DELETED": "disabled", "LIMIT_EXCEEDED": "paused", "FLAGGED": "paused",
}


class TemplateValidationError(ValueError):
    pass


def variables_in(text: str | None) -> list[int]:
    return sorted({int(m) for m in VAR_RE.findall(text or "")})


def validate_template(*, name: str, category: str, body: str, header_type: str, header_text: str | None, footer: str | None,
                      buttons: list[dict], body_examples: list[str], header_example: str | None) -> None:
    """Mirror Meta's structural rules so users get a clear error instead of a generic rejection."""
    if not NAME_RE.match(name):
        raise TemplateValidationError("Template name may only contain lowercase letters, numbers and underscores.")
    if category == "AUTHENTICATION":
        if header_type != "none" or footer or buttons:
            raise TemplateValidationError("Authentication templates use a fixed layout: no header, footer or custom buttons.")
        return
    if not body.strip():
        raise TemplateValidationError("Body text is required.")
    if len(body) > 1024:
        raise TemplateValidationError("Body must be 1024 characters or fewer.")

    vars_ = variables_in(body)
    if vars_ and vars_ != list(range(1, len(vars_) + 1)):
        raise TemplateValidationError("Body variables must be sequential starting at {{1}} ({{1}}, {{2}}, ...).")
    stripped = body.strip()
    if vars_ and (VAR_RE.match(stripped) or re.search(r"\{\{\s*\d+\s*\}\}$", stripped)):
        raise TemplateValidationError("Body cannot start or end with a variable — add some text around it.")
    if vars_ and len([e for e in body_examples if e and e.strip()]) < len(vars_):
        raise TemplateValidationError(f"Provide a sample value for each of the {len(vars_)} body variable(s).")
    if header_type == "text":
        if not header_text or not header_text.strip():
            raise TemplateValidationError("Header text is required.")
        if len(header_text) > 60:
            raise TemplateValidationError("Header text must be 60 characters or fewer.")
        if len(variables_in(header_text)) > 1:
            raise TemplateValidationError("Header text supports at most one variable.")
    elif header_type in MEDIA_HEADERS and not header_example:
        raise TemplateValidationError(f"A sample {header_type} URL is required for a {header_type} header.")
    elif header_type not in {"none", "text", *MEDIA_HEADERS}:
        raise TemplateValidationError("Unsupported header type.")

    if footer and len(footer) > 60:
        raise TemplateValidationError("Footer must be 60 characters or fewer.")

    qr = [b for b in buttons if b.get("type") == "quick_reply"]
    url = [b for b in buttons if b.get("type") == "url"]
    phone = [b for b in buttons if b.get("type") == "phone"]
    copy = [b for b in buttons if b.get("type") == "copy_code"]
    if len(buttons) > 10 or len(qr) > 10 or len(url) > 2 or len(phone) > 1 or len(copy) > 1:
        raise TemplateValidationError("Too many buttons (max: 10 total, 2 URL, 1 phone, 1 copy-code).")
    for b in buttons:
        if b.get("type") not in {"quick_reply", "url", "phone", "copy_code"}:
            raise TemplateValidationError(f"Unsupported button type '{b.get('type')}'.")
        if not (b.get("text") or "").strip() or len(b["text"]) > 25:
            raise TemplateValidationError("Every button needs text of 25 characters or fewer.")
        if b["type"] == "url" and not (b.get("url") or "").startswith(("http://", "https://")):
            raise TemplateValidationError("URL buttons need a full http(s) URL.")
        if b["type"] == "url" and "{{1}}" in b["url"] and not b.get("example"):
            raise TemplateValidationError("A dynamic URL button needs an example URL.")
        if b["type"] == "phone" and not re.fullmatch(r"\+?\d{6,15}", (b.get("phone") or "").replace(" ", "")):
            raise TemplateValidationError("Phone button needs a valid phone number.")


def build_meta_components(tpl: WhatsAppTemplate, header_handle: str | None = None) -> list[dict]:
    if tpl.category == "AUTHENTICATION":
        return [
            {"type": "BODY", "add_security_recommendation": True},
            {"type": "FOOTER", "code_expiration_minutes": 10},
            {"type": "BUTTONS", "buttons": [{"type": "OTP", "otp_type": "COPY_CODE", "text": "Copy code"}]},
        ]
    comps: list[dict[str, Any]] = []
    if tpl.header_type == "text":
        c: dict[str, Any] = {"type": "HEADER", "format": "TEXT", "text": tpl.header_text}
        if variables_in(tpl.header_text):
            c["example"] = {"header_text": [tpl.header_example or "Sample"]}
        comps.append(c)
    elif tpl.header_type in MEDIA_HEADERS:
        comps.append({"type": "HEADER", "format": tpl.header_type.upper(), "example": {"header_handle": [header_handle]}})

    body: dict[str, Any] = {"type": "BODY", "text": tpl.body}
    if variables_in(tpl.body):
        body["example"] = {"body_text": [[e for e in tpl.body_examples if e is not None][: len(variables_in(tpl.body))]]}
    comps.append(body)

    if tpl.footer:
        comps.append({"type": "FOOTER", "text": tpl.footer})

    if tpl.buttons:
        buttons: list[dict[str, Any]] = []
        for b in tpl.buttons:
            if b["type"] == "quick_reply":
                buttons.append({"type": "QUICK_REPLY", "text": b["text"]})
            elif b["type"] == "url":
                item: dict[str, Any] = {"type": "URL", "text": b["text"], "url": b["url"]}
                if "{{1}}" in b["url"]:
                    item["example"] = [b["example"]]
                buttons.append(item)
            elif b["type"] == "phone":
                buttons.append({"type": "PHONE_NUMBER", "text": b["text"], "phone_number": b["phone"]})
            elif b["type"] == "copy_code":
                buttons.append({"type": "COPY_CODE", "example": b.get("example") or "CODE123"})
        comps.append({"type": "BUTTONS", "buttons": buttons})
    return comps


def parse_meta_components(components: list[dict]) -> dict[str, Any]:
    """Meta components -> our flat columns (used when syncing templates created outside this app)."""
    out: dict[str, Any] = {"header_type": "none", "header_text": None, "header_example": None, "footer": None, "buttons": [], "body": "", "body_examples": []}
    for c in components or []:
        t = (c.get("type") or "").upper()
        if t == "HEADER":
            fmt = (c.get("format") or "TEXT").lower()
            out["header_type"] = fmt if fmt in {"text", *MEDIA_HEADERS} else "none"
            out["header_text"] = c.get("text")
            ex = c.get("example") or {}
            handles = ex.get("header_handle") or ex.get("header_text") or []
            out["header_example"] = handles[0] if handles else None
        elif t == "BODY":
            out["body"] = c.get("text", "")
            rows = (c.get("example") or {}).get("body_text") or []
            out["body_examples"] = list(rows[0]) if rows else []
        elif t == "FOOTER":
            out["footer"] = c.get("text")
        elif t == "BUTTONS":
            for b in c.get("buttons", []):
                bt = (b.get("type") or "").upper()
                if bt == "QUICK_REPLY":
                    out["buttons"].append({"type": "quick_reply", "text": b.get("text", "")})
                elif bt == "URL":
                    ex = b.get("example") or []
                    out["buttons"].append({"type": "url", "text": b.get("text", ""), "url": b.get("url", ""), "example": ex[0] if ex else None})
                elif bt == "PHONE_NUMBER":
                    out["buttons"].append({"type": "phone", "text": b.get("text", ""), "phone": b.get("phone_number", "")})
                elif bt == "OTP":
                    out["buttons"].append({"type": "otp", "text": b.get("text", "Copy code")})
                elif bt == "COPY_CODE":
                    out["buttons"].append({"type": "copy_code", "text": "Copy code", "example": (b.get("example") or [None])[0] if isinstance(b.get("example"), list) else b.get("example")})
                else:
                    out["buttons"].append({"type": bt.lower(), "text": b.get("text", "")})
    return out


# ---- send-time --------------------------------------------------------------------------------------------------

def required_variables(tpl: WhatsAppTemplate) -> dict[str, Any]:
    """What a sender must supply for this template: {header_text: bool, header_media: kind|None, body: [1..n], buttons: [idx...]}."""
    return {
        "header_text": tpl.header_type == "text" and bool(variables_in(tpl.header_text)),
        "header_media": tpl.header_type if tpl.header_type in MEDIA_HEADERS else None,
        "body": variables_in(tpl.body),
        "buttons": [i for i, b in enumerate(tpl.buttons or []) if b.get("type") == "otp" or (b.get("type") == "url" and "{{1}}" in (b.get("url") or ""))],
    }


def build_send_components(tpl: WhatsAppTemplate, *, body: list[str] | None = None, header_text: str | None = None,
                          header_media: str | None = None, buttons: dict[str, str] | None = None) -> list[dict]:
    """Assemble the `components` array for a template message. Raises TemplateValidationError if required values are missing."""
    need = required_variables(tpl)
    comps: list[dict[str, Any]] = []

    if need["header_text"]:
        if not header_text:
            raise TemplateValidationError("This template's header needs a value.")
        comps.append({"type": "header", "parameters": [{"type": "text", "text": header_text}]})
    elif need["header_media"]:
        if not header_media:
            raise TemplateValidationError(f"This template needs a {need['header_media']} URL for its header.")
        kind = need["header_media"]
        media: dict[str, Any] = {"link": header_media}
        if kind == "document":
            media["filename"] = header_media.rsplit("/", 1)[-1].split("?")[0] or "document"
        comps.append({"type": "header", "parameters": [{"type": kind, kind: media}]})

    if need["body"]:
        values = body or []
        if len(values) < len(need["body"]):
            raise TemplateValidationError(f"This template needs {len(need['body'])} body value(s); got {len(values)}.")
        comps.append({"type": "body", "parameters": [{"type": "text", "text": str(v) if str(v) != "" else " "} for v in values[: len(need["body"])]]})

    for idx in need["buttons"]:
        val = (buttons or {}).get(str(idx))
        if val is None:
            raise TemplateValidationError(f"Button {idx + 1} needs a URL value.")
        comps.append({"type": "button", "sub_type": "url", "index": str(idx), "parameters": [{"type": "text", "text": val}]})
    return comps


def render_preview(tpl: WhatsAppTemplate, body_values: list[str] | None = None) -> str:
    text = tpl.body or ""
    for i, v in enumerate(body_values or [], start=1):
        text = re.sub(r"\{\{\s*%d\s*\}\}" % i, str(v), text)
    return text


# ---- Meta sync --------------------------------------------------------------------------------------------------

def client_for(account: WhatsAppAccount) -> GraphClient:
    return GraphClient(decrypt(account.access_token_enc))


async def submit_template(db: AsyncSession, account: WhatsAppAccount, tpl: WhatsAppTemplate) -> None:
    """Submit a draft to Meta. Updates the row with Meta's id/status, or raises GraphError."""
    client = client_for(account)
    handle = None
    if tpl.header_type in MEDIA_HEADERS:
        app_id = (account.settings or {}).get("app_id") or get_settings().meta_app_id
        if not app_id:
            raise GraphError("Media headers need your Meta App ID (add it in WhatsApp settings) so the sample file can be uploaded.", status=400)
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
                resp = await http.get(tpl.header_example)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise GraphError(f"Could not download the sample {tpl.header_type} from the URL: {exc.__class__.__name__}", status=400) from exc
        mime = resp.headers.get("content-type", "").split(";")[0] or MEDIA_MIME_DEFAULT[tpl.header_type]
        handle = await client.upload_sample_handle(app_id, resp.content, mime)

    components = build_meta_components(tpl, handle)
    result = await client.create_template(account.waba_id, name=tpl.name, language=tpl.language, category=tpl.category, components=components)
    tpl.account_id = account.id
    tpl.meta_template_id = str(result.get("id")) if result.get("id") else tpl.meta_template_id
    tpl.status = STATUS_MAP.get((result.get("status") or "PENDING").upper(), "pending")
    if result.get("category"):
        tpl.category = result["category"].upper()
    tpl.components = components
    tpl.meta_rejection_reason = None
    tpl.last_synced_at = datetime.now(timezone.utc)
    await db.commit()


async def sync_templates(db: AsyncSession, account: WhatsAppAccount) -> dict[str, int]:
    """Pull every template from Meta and upsert by (name, language). Local drafts not on Meta are left alone."""
    client = client_for(account)
    remote = await client.list_templates(account.waba_id)
    existing = {
        (t.name, t.language): t
        for t in (await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == account.tenant_id))).scalars()
    }
    created = updated = 0
    now = datetime.now(timezone.utc)
    for r in remote:
        key = (r["name"], r.get("language", "en"))
        parsed = parse_meta_components(r.get("components", []))
        status = STATUS_MAP.get((r.get("status") or "").upper(), "pending")
        tpl = existing.get(key)
        if tpl is None:
            tpl = WhatsAppTemplate(tenant_id=account.tenant_id, name=r["name"], language=key[1], category=(r.get("category") or "UTILITY").upper(), body=parsed["body"] or " ")
            db.add(tpl)
            existing[key] = tpl
            created += 1
        else:
            updated += 1
        tpl.account_id = account.id
        tpl.category = (r.get("category") or tpl.category).upper()
        tpl.body = parsed["body"] or tpl.body
        tpl.header_type = parsed["header_type"]
        tpl.header_text = parsed["header_text"]
        tpl.header_example = parsed["header_example"] or tpl.header_example
        tpl.footer = parsed["footer"]
        tpl.buttons = parsed["buttons"]
        tpl.body_examples = parsed["body_examples"]
        tpl.components = r.get("components", [])
        tpl.status = status
        tpl.meta_template_id = str(r.get("id") or "") or tpl.meta_template_id
        tpl.meta_rejection_reason = r.get("rejected_reason") if r.get("rejected_reason") not in (None, "NONE") else None
        tpl.quality_score = ((r.get("quality_score") or {}).get("score") or None)
        tpl.is_deleted = False
        tpl.last_synced_at = now
    account.last_synced_at = now
    await db.commit()
    return {"created": created, "updated": updated, "total": len(remote)}


async def delete_template_remote(account: WhatsAppAccount, name: str) -> None:
    await client_for(account).delete_template(account.waba_id, name)


