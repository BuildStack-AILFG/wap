from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str
    database_url_sync: str

    jwt_secret: str
    refresh_token_secret: str

    access_token_expires_minutes: int = 60 * 24 * 7  # 7 days, matches the reference product
    refresh_token_expires_days: int = 30

    encryption_key: str = ""

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
