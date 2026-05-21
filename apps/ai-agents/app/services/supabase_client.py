"""Singleton supabase-py client.

Uses ``SUPABASE_SECRET_KEY`` (service role) — bypasses RLS. Only this Python
service holds the secret key; the dashboard / customer-demo use the anon key.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return the process-wide Supabase client (created lazily on first call)."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_secret_key)
