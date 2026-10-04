import json
import re
from functools import lru_cache
from typing import Annotated
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_SSL_MODES_REQUIRING_TLS = {"require", "verify-ca", "verify-full"}


def _rewrite_driver(url: str, driver: str) -> str:
    """Swap the SQLAlchemy driver in a Postgres URL. Accepts postgres://, postgresql://, or postgresql+<driver>://."""
    scheme, sep, rest = url.partition("://")
    if not sep or not scheme.startswith(("postgres", "postgresql")):
        raise ValueError("DATABASE_URL must be a PostgreSQL URL (postgres:// or postgresql://).")
    return f"postgresql+{driver}://{rest}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    # Any provider-style URL works: postgres://…, postgresql://…, or postgresql+asyncpg://…
    database_url: str
    # Optional — derived from database_url when unset.
    database_url_sync: str = ""

    jwt_secret: str
    refresh_token_secret: str

    access_token_expires_minutes: int = 60 * 24 * 7  # 7 days, matches the reference product
    refresh_token_expires_days: int = 30

    encryption_key: str = ""

    # Public URL of this API, used to build webhook callback URLs and widget embed snippets shown in the UI.
    public_base_url: str = ""

    # Meta / WhatsApp Cloud API. Per-workspace credentials (manual connect) live encrypted in whatsapp_accounts;
    # these platform-level values are only needed for Embedded Signup and a shared platform webhook.
    graph_api_base: str = "https://graph.facebook.com"
    graph_api_version: str = "v21.0"
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_config_id: str = ""  # Embedded Signup configuration id
    meta_webhook_verify_token: str = ""

    # AI agent. Each workspace can bring its own key (stored encrypted); this is the platform fallback.
    anthropic_api_key: str = ""
    anthropic_api_base: str = "https://api.anthropic.com"
    ai_model: str = "claude-sonnet-5"
    # Other AI providers a workspace can bring its own key for, and Vercel AI Gateway (one key, every provider's models).
    # A platform AI_GATEWAY_API_KEY, when set, is the metered fallback instead of ANTHROPIC_API_KEY.
    openai_api_base: str = "https://api.openai.com"
    xai_api_base: str = "https://api.x.ai"
    ai_gateway_api_base: str = "https://ai-gateway.vercel.sh"
    ai_gateway_api_key: str = ""
    ai_gateway_model: str = "anthropic/claude-sonnet-5.5"

    # "Continue with Google" sign-in. The OAuth *Web* client id from Google Cloud Console; the button is hidden when unset.
    google_client_id: str = ""

    # Transactional email (invites, password reset). Optional — without it, invite/reset links are returned to the caller.
    resend_api_key: str = ""
    # Or any SMTP mailbox (e.g. Hostinger: smtp.hostinger.com, port 465). Used when RESEND_API_KEY is unset.
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "TalkForGrow <no-reply@leadforgrow.com>"
    # Base URL of the web app, used in emailed links. Defaults to the first non-localhost CORS origin, so production needs no extra setting.
    frontend_url: str = ""

    # Razorpay (our own subscription billing). Keys come from the Razorpay dashboard; webhook secret is optional but recommended.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_api_base: str = "https://api.razorpay.com"
    billing_currency: str = "INR"
    gst_percent: int = 18
    # Seller details printed on invoices.
    company_name: str = "ScaleDesk Technology Pvt Ltd"
    company_gstin: str = ""
    company_address: str = ""
    company_email: str = ""
    # Where marketing-site contact / demo requests are emailed (optional; they are always stored).
    contact_notify_email: str = ""

    # In-process scheduler (scheduled broadcasts, flow waits). See lib/PHASES.md — single instance only.
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 15
    broadcast_send_delay_ms: int = 60

    # Comma-separated in the environment: CORS_ORIGINS=https://app.example.com,https://www.example.com
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:3001"]
    # Optional regex for dynamic origins, e.g. Vercel preview deploys: https://.*\.vercel\.app
    cors_origin_regex: str | None = None

    # Emails (comma-separated) that may open the platform admin console: PLATFORM_ADMIN_EMAILS=you@company.com,partner@company.com
    platform_admin_emails: Annotated[list[str], NoDecode] = []

    @field_validator("platform_admin_emails", mode="before")
    @classmethod
    def _split_admins(cls, v):
        if isinstance(v, str):
            v = json.loads(v) if v.strip().startswith("[") else v.split(",")
        return [e.strip().lower() for e in v if e.strip()]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            v = json.loads(v) if v.strip().startswith("[") else v.split(",")
        return [o.strip().rstrip("/") for o in v if o.strip()]

    @model_validator(mode="after")
    def _derive_urls(self):
        if not self.frontend_url:
            public = [o for o in self.cors_origins if "localhost" not in o and "127.0.0.1" not in o]
            self.frontend_url = (public or self.cors_origins or ["http://localhost:3000"])[0]
        if not self.database_url_sync:
            self.database_url_sync = _rewrite_driver(self.database_url, "psycopg")
        return self

    def app_url(self, origin: str | None = None) -> str:
        """Base URL for links we hand to users. Prefers the site the request came from (when it's an allowed
        CORS origin) so links follow a domain change without redeploying; otherwise FRONTEND_URL."""
        origin = (origin or "").strip().rstrip("/")
        if origin and (origin in self.cors_origins or (self.cors_origin_regex and re.fullmatch(self.cors_origin_regex, origin))):
            return origin
        return self.frontend_url.rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def async_database_url(self) -> str:
        """asyncpg URL with libpq-only params (sslmode) removed — asyncpg takes `ssl` via connect_args instead."""
        url = _rewrite_driver(self.database_url, "asyncpg")
        parts = urlsplit(url)
        query = [(k, v) for k, v in parse_qsl(parts.query) if k != "sslmode"]
        return urlunsplit(parts._replace(query=urlencode(query)))

    @property
    def database_requires_tls(self) -> bool:
        mode = dict(parse_qsl(urlsplit(self.database_url).query)).get("sslmode", "")
        return mode in _SSL_MODES_REQUIRING_TLS


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
