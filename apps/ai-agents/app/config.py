"""Centralised settings (pydantic-settings).

Loads from the repo-root `.env.local` in dev. In production (Vercel), the
platform injects environment variables directly and the `.env.local` file is
absent — that's fine, `pydantic-settings` will fall back to the process env.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo-root .env.local — three parents up from this file (app/config.py).
# `.parent` chaining (not `.parents[3]`) so shallow deploy paths never raise.
_REPO_ROOT_ENV = Path(__file__).resolve().parent.parent.parent.parent / ".env.local"


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

    knowledge_source: Literal["static", "vector"] = Field(
        default="static",
        description="static = policy doc in the prompt only (original behaviour); "
        "vector = also search the shared kb_chunks memory in Supabase",
    )
    embedding_model: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model; must match the vector(1536) column",
    )

    catalog_source: Literal["off", "shopify"] = Field(
        default="off",
        description="off = no live catalogue (original behaviour); "
        "shopify = product lookups via the Shopify Storefront API",
    )
    shopify_store: str = Field(default="", description="<store>.myshopify.com")
    shopify_storefront_token: str = Field(default="", description="Storefront API access token")
    shopify_api_version: str = Field(default="2026-07", description="Storefront API version")

    @field_validator("catalog_source", mode="before")
    @classmethod
    def _lenient_catalog_source(cls, value: object) -> str:
        """A typo in the catalogue flag must not stop the service — fall back to off."""
        normalized = str(value).strip().lower()
        if normalized in ("off", "shopify"):
            return normalized
        logging.getLogger(__name__).warning(
            "unknown CATALOG_SOURCE=%r — using 'off' (catalogue off)", value
        )
        return "off"

    @field_validator("knowledge_source", mode="before")
    @classmethod
    def _lenient_knowledge_source(cls, value: object) -> str:
        """A typo in the memory flag must not stop the service — fall back to static."""
        normalized = str(value).strip().lower()
        if normalized in ("static", "vector"):
            return normalized
        logging.getLogger(__name__).warning(
            "unknown KNOWLEDGE_SOURCE=%r — using 'static' (memory off)", value
        )
        return "static"

    port: int = Field(default=8000, description="HTTP listen port")
    log_level: str = Field(default="INFO", description="DEBUG/INFO/WARNING/ERROR")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton so we instantiate (and validate) only once per process."""
    return Settings()  # type: ignore[call-arg]
