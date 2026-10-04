"""Transactional email via Resend or SMTP (e.g. Hostinger). With neither configured nothing is sent and callers fall back to showing the link in the UI."""

from __future__ import annotations

import asyncio
import html as html_lib
import logging
import re
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


def to_text(html: str) -> str:
    """Plain-text twin of an HTML email. Sending both (not HTML-only) is one of the signals that keeps
    transactional mail out of Gmail's Promotions tab and spam folders."""
    t = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: m.group(1) if m.group(2).strip() in ("", m.group(1)) else f"{m.group(2)}: {m.group(1)}", html, flags=re.S)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"</(p|div|h\d)>", "\n\n", t)
    t = html_lib.unescape(re.sub(r"<[^>]+>", "", t))
    return re.sub(r"\n{3,}", "\n\n", "\n".join(line.strip() for line in t.splitlines())).strip()


def _send_smtp(to: str, subject: str, html: str, reply_to: str | None) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(to_text(html))
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


async def send(to: str, subject: str, html: str, reply_to: str | None = None) -> bool:
    s = get_settings()
    if not s.resend_api_key:
        if not _smtp_ready():
            log.warning("email to %s not sent: neither RESEND_API_KEY nor SMTP_* is configured", to)
            return False
        try:
            await asyncio.to_thread(_send_smtp, to, subject, html, reply_to)
            return True
        except (smtplib.SMTPException, OSError):
            log.exception("smtp send to %s failed", to)
            return False
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {s.resend_api_key}"},
                                   json={"from": s.email_from, "to": [to], "subject": subject, "html": html, "text": to_text(html),
                                         **({"reply_to": reply_to} if reply_to else {})})
        if resp.status_code >= 400:
            log.error("resend rejected email (%s): %s", resp.status_code, resp.text[:200])
            return False
        return True
    except httpx.HTTPError:
        log.exception("email send failed")
        return False


def button_html(heading: str, body: str, cta: str, url: str) -> str:
    """A plain, letter-style email: no hero heading, banner or big coloured button — those make Gmail file it as Promotions."""
    return (f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:520px">'
            f'<p>Hi,</p><p>{body}</p><p><a href="{url}" style="color:#00926B;font-weight:bold">{cta}</a></p>'
            f'<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>{url}</p><p>Thanks,<br>TalkForGrow</p></div>')
