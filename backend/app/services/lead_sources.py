"""
Lead sources we pull from on a schedule (vs. the push-style webhooks in integrations.py): IndiaMART Lead Manager and a Google
Sheet. Both feed the same ingest path as webhooks: upsert the contact by phone (so a lead seen twice is one contact), record the
event, run the configured template action / event flows, and start any "new lead" follow-up sequence.

IndiaMART Pull API (help.indiamart.com/knowledge-base/lms-crm-integration-v2): GET crmListing/v2 with glusr_crm_key, start_time and
end_time in IST; at most 7 days per call, at least 5 minutes between calls (more than 5 hits a minute blocks the key for 15
minutes). We poll every 15 minutes, overlapping each window by 5 minutes and de-duplicating on UNIQUE_QUERY_ID.

Google Sheets: the sheet must be shared "Anyone with the link can view"; we read its CSV export and only import rows added since
the last pass (like a "new spreadsheet row" trigger), so editing old rows doesn't re-message anyone.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.crypto import CryptoError, decrypt_json
from app.models.contact import Contact
from app.models.integration import Integration
from app.models.tenant import Tenant
from app.services import followups, quotas
from app.services.automation import events
from app.services.integrations import Normalized
from app.services.phone import InvalidPhone, normalize_phone
from app.services.whatsapp import messaging

log = logging.getLogger(__name__)

PULL = ("indiamart", "google-sheets")
INDIAMART_URL = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/"
INDIAMART_EVERY = timedelta(minutes=15)
INDIAMART_MIN_GAP = timedelta(minutes=5)
INDIAMART_OVERLAP = timedelta(minutes=5)
INDIAMART_MAX_RANGE = timedelta(days=7)
SHEETS_EVERY = timedelta(minutes=10)
IST = ZoneInfo("Asia/Kolkata")
SHEET_RE = re.compile(r"^https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]{20,})")
GID_RE = re.compile(r"[#?&]gid=(\d+)")
MAX_SHEET_BYTES = 5 * 1024 * 1024
MAX_ROWS_PER_PASS = 500
KEEP_IDS = 500
COLUMN_ALIASES = {"mobile": "phone", "phone_number": "phone", "phonenumber": "phone", "whatsapp": "phone", "number": "phone", "contact": "phone",
                  "mobile_number": "phone", "full_name": "name", "fullname": "name", "email_address": "email", "tag": "tags", "labels": "tags"}


class SourceError(Exception):
    """A pull that failed in a way the user should see on the integration card."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---- shared ingest ----------------------------------------------------------------------------------------------------------

async def ingest(db: AsyncSession, row: Integration, items: list[Normalized]) -> tuple[list[dict], int]:
    """Turn normalised leads into contacts + events + actions. Returns (per-lead results, ignored count). Commits."""
    tenant = await db.get(Tenant, row.tenant_id)
    cc = str((tenant.settings or {}).get("default_country_code", "")) if tenant else ""
    actions = (row.config or {}).get("actions", {})
    processed, ignored = [], 0
    for n in items:
        try:
            phone = normalize_phone(n.phone, cc)
        except InvalidPhone:
            ignored += 1
            continue
        contact, created = await messaging.upsert_contact(db, row.tenant_id, phone, name=n.name, source=row.provider, email=n.email)
        if created:
            total = (await db.execute(select(func.count()).select_from(Contact).where(Contact.tenant_id == row.tenant_id))).scalar_one()
            try:
                await quotas.enforce(db, row.tenant_id, "max_contacts", total - 1, label="contacts")
            except HTTPException:
                await db.rollback()
                ignored += 1
                continue
        if n.name and not created and contact.name.startswith("+"):
            contact.name = n.name
        if n.email and not contact.email:
            contact.email = n.email
        if n.tags:
            before = set(contact.tags or [])
            contact.tags = sorted({*(contact.tags or []), *[t[:50] for t in n.tags]})[:50]
            await followups.on_tags_added(db, contact, set(contact.tags) - before)
        if n.traits:
            contact.custom_fields = {**(contact.custom_fields or {}), **n.traits}
        if created:
            await followups.on_new_lead(db, contact, row.provider)
        processed.append(await events.process(db, row.tenant_id, contact, n.event, n.properties, row.provider, action=actions.get(n.event)))
    row.last_event_at, row.last_error, row.status = utcnow(), None, "connected"
    await db.commit()
    return processed, ignored


def _secret(row: Integration) -> str:
    if not row.credentials_enc:
        raise SourceError("Not set up yet: add your key / link and save.")
    try:
        return str(decrypt_json(row.credentials_enc).get("secret") or "")
    except CryptoError as exc:
        raise SourceError("Saved credentials can't be read. Paste them again.") from exc


def _cfg(row: Integration) -> dict:
    return dict(row.config or {})


def _save_cfg(row: Integration, cfg: dict) -> None:
    row.config = cfg
    flag_modified(row, "config")


# ---- IndiaMART ---------------------------------------------------------------------------------------------------------------

def _im_time(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%d-%m-%Y%H:%M:%S")


def parse_indiamart(data: dict) -> list[tuple[str, Normalized]]:
    """(UNIQUE_QUERY_ID, lead) pairs from a crmListing/v2 response. Leads without a mobile number are skipped (we message on WhatsApp)."""
    out = []
    for lead in data.get("RESPONSE") or []:
        if not isinstance(lead, dict) or not lead.get("SENDER_MOBILE"):
            continue
        qid = str(lead.get("UNIQUE_QUERY_ID") or "")
        message = str(lead.get("QUERY_MESSAGE") or "").strip()
        props: dict[str, Any] = {k.lower(): str(v)[:500] for k, v in lead.items() if v not in (None, "") and k in {
            "UNIQUE_QUERY_ID", "QUERY_TYPE", "QUERY_TIME", "QUERY_MESSAGE", "SENDER_COUNTRY_ISO", "QUERY_PRODUCT_NAME", "SENDER_COMPANY", "SENDER_CITY", "SENDER_STATE", "SUBJECT"}}
        traits = {k: v for k, v in {"indiamart_enquiry": message[:300], "indiamart_product": str(lead.get("QUERY_PRODUCT_NAME") or "")[:120],
                                    "company": str(lead.get("SENDER_COMPANY") or "")[:120], "city": str(lead.get("SENDER_CITY") or "")[:80]}.items() if v}
        name = str(lead.get("SENDER_NAME") or "").strip()
        out.append((qid, Normalized(phone=str(lead["SENDER_MOBILE"]), event="indiamart_lead", name=None if name in ("", "IndiaMART Buyer") else name,
                                    email=str(lead.get("SENDER_EMAIL") or "").strip() or None, properties=props, tags=["indiamart"], traits=traits)))
    return out


async def pull_indiamart(db: AsyncSession, row: Integration, *, force: bool = False) -> dict:
    cfg, now = _cfg(row), utcnow()
    last_call = datetime.fromisoformat(cfg["last_call_at"]) if cfg.get("last_call_at") else None
    if last_call and now - last_call < (INDIAMART_MIN_GAP if force else INDIAMART_EVERY):
        wait = int(((INDIAMART_MIN_GAP if force else INDIAMART_EVERY) - (now - last_call)).total_seconds() // 60) + 1
        raise SourceError(f"IndiaMART allows one check every 5 minutes. Try again in {wait} min.") if force else SourceError("not due")
    key = _secret(row)
    last_end = datetime.fromisoformat(cfg["last_end"]) if cfg.get("last_end") else now - timedelta(hours=24)
    start = max(last_end - INDIAMART_OVERLAP, now - INDIAMART_MAX_RANGE)
    cfg["last_call_at"] = now.isoformat()
    _save_cfg(row, cfg)
    await db.commit()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as http:
            resp = await http.get(INDIAMART_URL, params={"glusr_crm_key": key, "start_time": _im_time(start), "end_time": _im_time(now)})
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SourceError(f"Couldn't reach IndiaMART ({exc.__class__.__name__}). We'll retry automatically.") from exc
    code = int(data.get("CODE") or resp.status_code)
    if code not in (200, 204):
        raise SourceError(f"IndiaMART: {str(data.get('MESSAGE') or 'request rejected')[:200]}")
    seen = list(cfg.get("recent_ids") or [])
    fresh = [(qid, n) for qid, n in parse_indiamart(data) if not qid or qid not in seen]
    processed, ignored = await ingest(db, row, [n for _, n in fresh])
    cfg = _cfg(row)
    cfg["recent_ids"] = (seen + [qid for qid, _ in fresh if qid])[-KEEP_IDS:]
    cfg["last_end"] = now.isoformat()
    _save_cfg(row, cfg)
    await db.commit()
    return {"new_leads": len(processed), "ignored": ignored}


# ---- Google Sheets -----------------------------------------------------------------------------------------------------------

def sheet_csv_url(link: str) -> str:
    """The CSV export URL for a Google Sheets link (any tab: the #gid in the link picks it). Raises SourceError for anything else."""
    m = SHEET_RE.match(link.strip())
    if not m:
        raise SourceError("Paste the link of a Google Sheet (https://docs.google.com/spreadsheets/d/…).")
    gid = GID_RE.search(link)
    return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv" + (f"&gid={gid.group(1)}" if gid else "")


def parse_sheet(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    headers = [COLUMN_ALIASES.get(k, k) for k in ((h or "").strip().lower().replace(" ", "_") for h in reader.fieldnames)]
    if "phone" not in headers:
        raise SourceError("The sheet needs a 'phone' column (also accepted: mobile, whatsapp, number).")
    return [{headers[i]: (v or "").strip() for i, v in enumerate(r.values()) if i < len(headers) and headers[i]} for r in reader]


def sheet_rows_to_leads(rows: list[dict]) -> list[Normalized]:
    out = []
    for r in rows:
        if not r.get("phone"):
            continue
        tags = [t.strip() for t in r.get("tags", "").replace(";", ",").split(",") if t.strip()]
        traits = {k: v[:300] for k, v in r.items() if k not in {"phone", "name", "email", "tags"} and v}
        out.append(Normalized(phone=r["phone"], event="sheet_lead", name=r.get("name") or None, email=r.get("email") or None,
                              properties={k: v[:300] for k, v in r.items() if v}, tags=["google-sheets", *tags], traits=traits))
    return out


async def pull_sheet(db: AsyncSession, row: Integration, *, force: bool = False) -> dict:
    cfg, now = _cfg(row), utcnow()
    last_call = datetime.fromisoformat(cfg["last_call_at"]) if cfg.get("last_call_at") else None
    if not force and last_call and now - last_call < SHEETS_EVERY:
        raise SourceError("not due")
    url = sheet_csv_url(_secret(row))
    cfg["last_call_at"] = now.isoformat()
    _save_cfg(row, cfg)
    await db.commit()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), follow_redirects=True) as http:
            resp = await http.get(url)
    except httpx.HTTPError as exc:
        raise SourceError(f"Couldn't reach Google Sheets ({exc.__class__.__name__}). We'll retry automatically.") from exc
    if resp.status_code != 200 or "text/csv" not in resp.headers.get("content-type", ""):
        raise SourceError("Couldn't read the sheet. In Google Sheets: Share → General access → 'Anyone with the link' → Viewer.")
    if len(resp.content) > MAX_SHEET_BYTES:
        raise SourceError("The sheet is larger than 5 MB.")
    rows = parse_sheet(resp.content.decode("utf-8-sig", errors="replace"))
    done = int(cfg.get("rows_done", 0) or 0)
    if done > len(rows):  # rows were deleted: start counting again from the current end, without re-importing
        done = len(rows)
    first_pass = "rows_done" not in cfg and not cfg.get("import_existing")
    new_rows = [] if first_pass else rows[done:done + MAX_ROWS_PER_PASS]
    processed, ignored = await ingest(db, row, sheet_rows_to_leads(new_rows))
    cfg = _cfg(row)
    cfg["rows_done"] = len(rows) if first_pass else done + len(new_rows)
    _save_cfg(row, cfg)
    await db.commit()
    return {"new_leads": len(processed), "ignored": ignored, "rows_in_sheet": len(rows), "skipped_existing_rows": len(rows) if first_pass else 0}


# ---- scheduler ---------------------------------------------------------------------------------------------------------------

PULLERS = {"indiamart": pull_indiamart, "google-sheets": pull_sheet}


async def pull(db: AsyncSession, row: Integration, *, force: bool = False) -> dict:
    """Run one pull; failures are stored on the integration (and re-raised as SourceError when forced from the dashboard)."""
    row_id, provider = row.id, row.provider  # read before a rollback expires the row
    try:
        return await PULLERS[provider](db, row, force=force)
    except SourceError as exc:
        if str(exc) != "not due":
            await db.rollback()
            row = await db.get(Integration, row_id, populate_existing=True)
            row.last_error, row.status = str(exc), "error"
            await db.commit()
        raise


async def poll_all(session_factory) -> int:
    async with session_factory() as db:
        ids = (await db.execute(select(Integration.id).where(Integration.provider.in_(PULL), Integration.credentials_enc.is_not(None)))).scalars().all()
    n = 0
    for iid in ids:
        async with session_factory() as db:
            row = await db.get(Integration, iid)
            if row is None:
                continue
            try:
                await pull(db, row)
                n += 1
            except SourceError:
                pass
            except Exception:  # noqa: BLE001
                log.exception("lead source pull failed for integration %s", iid)
                await db.rollback()
    return n
