"""WhatsApp message templates: build, validate, submit to Meta, sync status, delete."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Ctx, get_ctx, get_db, require_writer
from app.models.template import WhatsAppTemplate
from app.models.tenant import Tenant
from app.models.whatsapp_account import WhatsAppAccount
from app.services.ai import agent as ai_agent
from app.services.whatsapp import templates as svc
from app.services.whatsapp.graph import GraphError

router = APIRouter(prefix="/templates", tags=["templates"])

Category = Literal["MARKETING", "UTILITY", "AUTHENTICATION"]


class ButtonIn(BaseModel):
    type: Literal["quick_reply", "url", "phone", "copy_code"]
    text: str = Field(default="", max_length=25)
    url: str | None = Field(default=None, max_length=2000)
    phone: str | None = Field(default=None, max_length=20)
    example: str | None = Field(default=None, max_length=2000)


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    language: str = Field(default="en", max_length=16)
    category: Category
    body: str = Field(default="", max_length=1024)
    header_type: Literal["none", "text", "image", "video", "document"] = "none"
    header_text: str | None = Field(default=None, max_length=60)
    header_example: str | None = Field(default=None, max_length=2000)
    footer: str | None = Field(default=None, max_length=60)
    buttons: list[ButtonIn] = Field(default_factory=list, max_length=10)
    body_examples: list[str] = Field(default_factory=list, max_length=20)
    submit: bool = True
    account_id: uuid.UUID | None = None


def _out(t: WhatsAppTemplate) -> dict:
    return {
        "id": str(t.id), "name": t.name, "language": t.language, "category": t.category, "body": t.body, "status": t.status,
        "header_type": t.header_type, "header_text": t.header_text, "header_example": t.header_example, "footer": t.footer, "buttons": t.buttons or [],
        "body_examples": t.body_examples or [], "rejection_reason": t.meta_rejection_reason, "quality_score": t.quality_score, "meta_template_id": t.meta_template_id,
        "requires": svc.required_variables(t), "last_synced_at": t.last_synced_at.isoformat() if t.last_synced_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None, "account_id": str(t.account_id) if t.account_id else None,
    }


async def _owned(db: AsyncSession, ctx: Ctx, template_id: uuid.UUID) -> WhatsAppTemplate:
    t = await db.get(WhatsAppTemplate, template_id)
    if t is None or t.tenant_id != ctx.tenant_id or t.is_deleted:
        raise HTTPException(status_code=404, detail={"error": "Template not found."})
    return t


async def _account(db: AsyncSession, ctx: Ctx, account_id: uuid.UUID | None) -> WhatsAppAccount | None:
    q = select(WhatsAppAccount).where(WhatsAppAccount.tenant_id == ctx.tenant_id, WhatsAppAccount.status != "disconnected")
    if account_id:
        q = q.where(WhatsAppAccount.id == account_id)
    return (await db.execute(q.order_by(WhatsAppAccount.created_at).limit(1))).scalar_one_or_none()


@router.get("/library")
async def library(_: Ctx = Depends(get_ctx)) -> list[dict]:
    """Starter templates to prefill the builder (still need Meta approval like any other)."""
    return LIBRARY


@router.get("")
async def list_templates(status_: str | None = Query(None, alias="status"), category: str | None = None, q: str | None = None,
                         ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> list[dict]:
    cond = [WhatsAppTemplate.tenant_id == ctx.tenant_id, WhatsAppTemplate.is_deleted.is_(False)]
    if status_:
        cond.append(WhatsAppTemplate.status == status_)
    if category:
        cond.append(WhatsAppTemplate.category == category.upper())
    if q:
        cond.append(or_(WhatsAppTemplate.name.ilike(f"%{q}%"), WhatsAppTemplate.body.ilike(f"%{q}%")))
    rows = (await db.execute(select(WhatsAppTemplate).where(*cond).order_by(WhatsAppTemplate.created_at.desc()))).scalars().all()
    return [_out(t) for t in rows]


@router.get("/{template_id}")
async def get_template(template_id: uuid.UUID, ctx: Ctx = Depends(get_ctx), db: AsyncSession = Depends(get_db)) -> dict:
    return _out(await _owned(db, ctx, template_id))


def _apply(t: WhatsAppTemplate, body: TemplateIn) -> None:
    t.name, t.language, t.category, t.body = body.name, body.language, body.category, body.body
    t.header_type, t.header_text, t.header_example = body.header_type, body.header_text, body.header_example
    t.footer = body.footer or None
    t.buttons = [b.model_dump(exclude_none=True) for b in body.buttons]
    t.body_examples = body.body_examples
    if body.category == "AUTHENTICATION":  # fixed Meta layout: the code is the only variable
        t.body, t.body_examples, t.buttons, t.header_type, t.header_text, t.footer = "{{1}} is your verification code. For your security, do not share this code.", ["123456"], [{"type": "otp", "text": "Copy code"}], "none", None, None


def _validate(body: TemplateIn) -> None:
    try:
        svc.validate_template(name=body.name, category=body.category, body=body.body, header_type=body.header_type, header_text=body.header_text,
                              footer=body.footer, buttons=[b.model_dump(exclude_none=True) for b in body.buttons], body_examples=body.body_examples,
                              header_example=body.header_example)
    except svc.TemplateValidationError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc)})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(body: TemplateIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    _validate(body)
    t = WhatsAppTemplate(tenant_id=ctx.tenant_id, status="draft")
    _apply(t, body)
    db.add(t)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"error": "A template with this name and language already exists."})
    result = _out(t)
    account = await _account(db, ctx, body.account_id) if body.submit else None
    if body.submit and account is None:
        await db.commit()
        return {**result, "submit_error": "Saved as a draft — connect a WhatsApp number to submit it to Meta."}
    if account is not None:
        try:
            await svc.submit_template(db, account, t)
        except GraphError as exc:
            await db.commit()
            return {**_out(t), "submit_error": f"Saved as a draft. Meta rejected the submission: {exc}"}
        return _out(t)
    await db.commit()
    return _out(t)


@router.put("/{template_id}")
async def update_template(template_id: uuid.UUID, body: TemplateIn, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    t = await _owned(db, ctx, template_id)
    if t.status != "draft":
        raise HTTPException(status_code=409, detail={"error": "Only drafts can be edited. Duplicate this template to make changes."})
    _validate(body)
    _apply(t, body)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"error": "A template with this name and language already exists."})
    return _out(t)


@router.post("/{template_id}/submit")
async def submit(template_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    t = await _owned(db, ctx, template_id)
    if t.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=409, detail={"error": f"This template is already {t.status}."})
    account = await _account(db, ctx, t.account_id)
    if account is None:
        raise HTTPException(status_code=409, detail={"error": "Connect a WhatsApp number first.", "code": "no_account"})
    try:
        await svc.submit_template(db, account, t)
    except GraphError as exc:
        raise HTTPException(status_code=502 if exc.is_transient else 422, detail={"error": f"Meta rejected the template: {exc}"})
    return _out(t)


@router.post("/{template_id}/duplicate", status_code=201)
async def duplicate(template_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    src = await _owned(db, ctx, template_id)
    base, n = src.name.rsplit("_v", 1)[0], 2
    existing = {n_ for (n_,) in (await db.execute(select(WhatsAppTemplate.name).where(WhatsAppTemplate.tenant_id == ctx.tenant_id, WhatsAppTemplate.language == src.language)))}
    while f"{base}_v{n}" in existing:
        n += 1
    copy = WhatsAppTemplate(tenant_id=ctx.tenant_id, name=f"{base}_v{n}", language=src.language, category=src.category, body=src.body, header_type=src.header_type,
                            header_text=src.header_text, header_example=src.header_example, footer=src.footer, buttons=src.buttons, body_examples=src.body_examples, status="draft")
    db.add(copy)
    await db.commit()
    return _out(copy)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_template(template_id: uuid.UUID, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> None:
    t = await _owned(db, ctx, template_id)
    if t.meta_template_id and t.account_id:
        account = await db.get(WhatsAppAccount, t.account_id)
        if account is not None and account.status != "disconnected":
            try:
                await svc.delete_template_remote(account, t.name)
            except GraphError as exc:
                if exc.code not in {100, 132001}:  # 132001 = already gone on Meta; anything else should be visible
                    raise HTTPException(status_code=502, detail={"error": f"Could not delete the template on WhatsApp: {exc}"})
    t.is_deleted = True
    await db.commit()


class DraftRequest(BaseModel):
    description: str = Field(min_length=5, max_length=600)
    category: Category = "MARKETING"
    language: str = "English"


@router.post("/ai-draft")
async def ai_draft(body: DraftRequest, ctx: Ctx = Depends(require_writer), db: AsyncSession = Depends(get_db)) -> dict:
    """AI Copilot: draft template copy from a short description."""
    tenant = await db.get(Tenant, ctx.tenant_id)
    try:
        key, own = ai_agent._api_key(tenant)
        await ai_agent._meter(db, tenant, own)
        raw = await ai_agent.complete(
            key, max_tokens=500,
            system=("You write WhatsApp Business message templates that comply with Meta's policies. Output ONLY JSON: "
                    '{"name": snake_case_name, "body": text using {{1}}, {{2}} placeholders (never at the very start or end), "footer": short optional footer or "", '
                    '"body_examples": [sample value for each placeholder]}. Body max 600 characters, no markdown. '
                    f"Category: {body.category}. Language: {body.language}. "
                    + ("Marketing copy must be clear and offer an opt-out path in the footer (e.g. 'Reply STOP to opt out')." if body.category == "MARKETING" else "")),
            messages=[{"role": "user", "content": body.description}],
        )
    except ai_agent.AIUnavailable as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc), "code": "ai_unavailable"})
    data = ai_agent._parse_json(raw)
    if not data or not data.get("body"):
        raise HTTPException(status_code=502, detail={"error": "The AI didn't return a usable draft. Try rephrasing."})
    await db.commit()
    return {"name": str(data.get("name", "new_template"))[:60], "body": str(data["body"])[:1024], "footer": str(data.get("footer") or "")[:60], "body_examples": [str(x) for x in data.get("body_examples", [])]}


LIBRARY: list[dict] = [
    {"key": "order_confirmation", "title": "Order confirmation", "category": "UTILITY", "name": "order_confirmation", "body": "Hi {{1}}, thanks for your order #{{2}}! We'll notify you as soon as it ships.", "body_examples": ["Priya", "10452"], "footer": None, "buttons": []},
    {"key": "shipping_update", "title": "Shipping update", "category": "UTILITY", "name": "shipping_update", "body": "Good news {{1}}! Your order #{{2}} has shipped and will arrive by {{3}}.", "body_examples": ["Priya", "10452", "Friday"], "footer": None,
     "buttons": [{"type": "url", "text": "Track order", "url": "https://example.com/track/{{1}}", "example": "https://example.com/track/10452"}]},
    {"key": "payment_reminder", "title": "Payment reminder", "category": "UTILITY", "name": "payment_reminder", "body": "Hi {{1}}, a friendly reminder that payment of {{2}} is due on {{3}}.", "body_examples": ["Priya", "Rs. 1,499", "30 Sep"], "footer": None, "buttons": []},
    {"key": "abandoned_cart", "title": "Abandoned cart", "category": "MARKETING", "name": "abandoned_cart", "body": "Hi {{1}}, you left something in your cart. Complete your order today and enjoy free delivery!", "body_examples": ["Priya"], "footer": "Reply STOP to opt out",
     "buttons": [{"type": "quick_reply", "text": "Complete order"}, {"type": "quick_reply", "text": "No thanks"}]},
    {"key": "welcome_offer", "title": "Welcome offer", "category": "MARKETING", "name": "welcome_offer", "body": "Welcome, {{1}}! Use code {{2}} for 10% off your first order.", "body_examples": ["Priya", "WELCOME10"], "footer": "Reply STOP to opt out", "buttons": []},
    {"key": "festive_sale", "title": "Festive sale", "category": "MARKETING", "name": "festive_sale", "body": "Our biggest sale is live! Save up to {{1}} on your favourites until {{2}}.", "body_examples": ["50%", "Sunday"], "footer": "Reply STOP to opt out",
     "buttons": [{"type": "url", "text": "Shop now", "url": "https://example.com/sale"}]},
    {"key": "feedback", "title": "Feedback request", "category": "UTILITY", "name": "feedback_request", "body": "Hi {{1}}, how was your experience with us? Your feedback helps us improve.", "body_examples": ["Priya"], "footer": None,
     "buttons": [{"type": "quick_reply", "text": "Great"}, {"type": "quick_reply", "text": "Okay"}, {"type": "quick_reply", "text": "Poor"}]},
    {"key": "otp", "title": "One-time passcode", "category": "AUTHENTICATION", "name": "login_otp", "body": "{{1}} is your verification code. For your security, do not share this code.", "body_examples": ["123456"], "footer": None, "buttons": []},
]
