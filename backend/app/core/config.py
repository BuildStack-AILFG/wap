import json
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

    # Comma-separated in the environment: CORS_ORIGINS=https://app.example.com,https://www.example.com
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:3001"]
    # Optional regex for dynamic origins, e.g. Vercel preview deploys: https://.*\.vercel\.app
    cors_origin_regex: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            v = json.loads(v) if v.strip().startswith("[") else v.split(",")
        return [o.strip().rstrip("/") for o in v if o.strip()]

    @model_validator(mode="after")
    def _derive_urls(self):
        if not self.database_url_sync:
            self.database_url_sync = _rewrite_driver(self.database_url, "psycopg")
        return self

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
