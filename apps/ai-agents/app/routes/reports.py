"""Gap report for the CS team: GET /reports/gaps?days=7&limit=100.

Guarded by the ``X-Gaps-Key`` header (GAPS_API_KEY), as in the Shopify chatbot:
key unset → 404 (route looks absent), wrong key → 401.
"""

from __future__ import annotations

import asyncio
import hmac

from fastapi import APIRouter, Header, HTTPException, Query

from app.config import get_settings
from app.gaps import list_gaps

router = APIRouter(prefix="/reports", tags=["reports"])


def _check_key(given: str | None) -> None:
    expected = get_settings().gaps_api_key
    if not expected:
        raise HTTPException(status_code=404, detail="Not Found")
    if not given or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="invalid gaps key")


@router.get("/gaps")
async def gaps_report(
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=100, ge=1, le=1000),
    x_gaps_key: str | None = Header(default=None),
) -> dict:
    _check_key(x_gaps_key)
    return await asyncio.to_thread(list_gaps, days, limit)
