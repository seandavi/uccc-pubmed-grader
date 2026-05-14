"""Application configuration via environment variables.

Reads from `.env` in local dev (gitignored) and from process env in deployed
environments (where GCP Secret Manager populates them at deploy time).
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    icite_base_url: str = "https://icite.od.nih.gov/api"
    icite_batch_size: int = Field(default=200, ge=1, le=1000)
    icite_timeout_seconds: float = 30.0

    log_level: str = "INFO"
    max_upload_bytes: int = 50 * 1024 * 1024
    job_ttl_seconds: int = 3600


def get_settings() -> Settings:
    return Settings()
