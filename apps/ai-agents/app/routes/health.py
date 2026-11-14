"""GET /health — liveness probe for Vercel + monitoring."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.catalog.service import catalog_enabled
from app.config import get_settings
from app.orders.service import orders_enabled

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    """Fast, no I/O, no DB call. Feature switches are reported (never their secrets)
    so a deploy can be verified without placing a test call."""
    settings = get_settings()
    return {
        "status": "ok",
        "service": "joola-ai-agents",
        "version": __version__,
        "knowledge_source": settings.knowledge_source,
        "catalog_enabled": catalog_enabled(),
        "orders_enabled": orders_enabled(),
        "internal_auth": bool(settings.ai_agents_secret),
    }
