"""Transactional email via Resend or SMTP (e.g. Hostinger). With neither configured nothing is sent and callers fall back to showing the link in the UI."""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)


def _smtp_ready() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_user and s.smtp_password)


def enabled() -> bool:
    return bool(get_settings().resend_api_key) or _smtp_ready()


def _send_smtp(to: str, subject: str, html: str) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
    msg.set_content("This email needs an HTML-capable mail client.")
    msg.add_alternative(html, subtype="html")
    ctx = ssl.create_default_context()
    if s.smtp_port == 465:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ctx, timeout=15) as smtp:
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls(context=ctx)
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)


async def send(to: str, subject: str, html: str) -> bool:
    s = get_settings()
    if not s.resend_api_key:
        if not _smtp_ready():
            log.warning("email to %s not sent: neither RESEND_API_KEY nor SMTP_* is configured", to)
            return False
        try:
            await asyncio.to_thread(_send_smtp, to, subject, html)
            return True
        except (smtplib.SMTPException, OSError):
            log.exception("smtp send to %s failed", to)
            return False
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {s.resend_api_key}"},
                                   json={"from": s.email_from, "to": [to], "subject": subject, "html": html})
        if resp.status_code >= 400:
            log.error("resend rejected email (%s): %s", resp.status_code, resp.text[:200])
            return False
        return True
    except httpx.HTTPError:
        log.exception("email send failed")
        return False


def button_html(heading: str, body: str, cta: str, url: str) -> str:
    return (f'<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#111">{heading}</h2>'
            f'<p style="color:#444;line-height:1.5">{body}</p><p><a href="{url}" style="background:#00926B;color:#fff;padding:12px 20px;border-radius:8px;'
            f'text-decoration:none;display:inline-block">{cta}</a></p><p style="color:#888;font-size:12px">If the button doesn\'t work, paste this link into your browser:<br>{url}</p></div>')
