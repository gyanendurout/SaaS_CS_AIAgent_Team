"""Centralised settings (pydantic-settings).

Loads from the repo-root `.env.local` in dev. In production (Railway), the
platform injects environment variables directly and the `.env.local` file is
absent — that's fine, `pydantic-settings` will fall back to the process env.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo-root .env.local — three parents up from this file (app/config.py).
_REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env.local"


class Settings(BaseSettings):
    """All runtime configuration for the AI Agents service."""

    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT_ENV) if _REPO_ROOT_ENV.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    supabase_url: str = Field(..., description="https://<project>.supabase.co")
    supabase_secret_key: str = Field(
        ..., description="sb_secret_... — bypasses RLS, server-side only"
    )

    openai_api_key: str = Field(..., description="OpenAI API key for GPT-4o response agent")
    openai_model: str = Field(default="gpt-4o", description="OpenAI model id")

    policy_version: str = Field(default="1.0.0", description="warranty_policy.__POLICY_VERSION__")

    port: int = Field(default=8000, description="HTTP listen port")
    log_level: str = Field(default="INFO", description="DEBUG/INFO/WARNING/ERROR")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton so we instantiate (and validate) only once per process."""
    return Settings()  # type: ignore[call-arg]
