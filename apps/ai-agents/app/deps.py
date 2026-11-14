"""FastAPI ``Depends()`` factories.

Thin wrappers around the singletons in :mod:`app.services` so route handlers
can declare typed dependencies and tests can override them.
"""

from __future__ import annotations

import hmac
from typing import TYPE_CHECKING

from fastapi import Header, HTTPException

from app.config import Settings, get_settings
from app.services.openai_client import get_openai
from app.services.supabase_client import get_supabase

if TYPE_CHECKING:
    from openai import OpenAI
    from supabase import Client


def settings_dep() -> Settings:
    """FastAPI dependency: validated settings singleton."""
    return get_settings()


def supabase_dep() -> "Client":
    """FastAPI dependency: supabase-py client (server-role, bypasses RLS)."""
    return get_supabase()


def openai_dep() -> "OpenAI":
    """FastAPI dependency: OpenAI v1 client."""
    return get_openai()


def require_internal_secret(
    x_internal_secret: str | None = Header(default=None),
) -> None:
    """Guard for endpoints that spend money per call (OpenAI embeddings, Shopify).

    Open when AI_AGENTS_SECRET is unset (backward compatible). When set, the
    caller must send the same value as ``X-Internal-Secret``.
    """
    expected = get_settings().ai_agents_secret
    if not expected:
        return
    # Compare bytes: compare_digest(str, str) raises TypeError on non-ASCII input,
    # which would turn a bad header (e.g. "café") into a 500 instead of a 401.
    if not x_internal_secret or not hmac.compare_digest(
        x_internal_secret.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="invalid internal secret")
