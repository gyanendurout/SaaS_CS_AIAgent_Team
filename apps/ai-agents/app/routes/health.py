"""GET /health — liveness probe for Railway + monitoring."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Return a constant payload — fast, no I/O, no DB call."""
    return {"status": "ok", "service": "joola-ai-agents", "version": __version__}
