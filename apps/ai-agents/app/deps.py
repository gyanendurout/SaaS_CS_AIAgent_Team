"""FastAPI ``Depends()`` factories.

Thin wrappers around the singletons in :mod:`app.services` so route handlers
can declare typed dependencies and tests can override them.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

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
