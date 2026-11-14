"""Gated live order status used by /tools/get_order_status (voice) and future channels.

Never raises. Outcomes (``status``):
  disabled              ORDER_SOURCE=off or credentials missing (original behaviour)
  invalid_order_number  fewer than 3 / more than 10 digits
  needs_verification    no email or postcode given — Shopify is not called
  not_found             no such order, OR the details don't match (same answer,
                        so a wrong email can't confirm that an order exists)
  too_many_attempts     too many failed POSTCODE checks for this order number (or
                        overall) recently and no email given — a brake on guessing;
                        applies whether or not the order exists. Email checks still run.
  unavailable           Shopify failed
  ok                    ``order`` holds the status-only view (no personal data)
"""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from app.config import get_settings
from app.orders.admin import AdminClient, map_order, parse_order_number, verify_caller

log = logging.getLogger(__name__)


def orders_enabled() -> bool:
    s = get_settings()
    return s.order_source == "shopify" and bool(
        s.shopify_store and s.shopify_admin_client_id and s.shopify_admin_client_secret
    )


_client: AdminClient | None = None
_client_key: tuple[str, str, str, str] | None = None


def get_client() -> AdminClient:
    """Process-wide client so the token and connection pool are reused."""
    global _client, _client_key
    s = get_settings()
    key = (s.shopify_store, s.shopify_admin_client_id, s.shopify_admin_client_secret,
           s.shopify_api_version)
    if _client is None or _client_key != key:
        _client = AdminClient(store=key[0], client_id=key[1], client_secret=key[2],
                              api_version=key[3])
        _client_key = key
    return _client


def reset_client() -> None:
    global _client, _client_key
    _client, _client_key = None, None
    _list_cache.clear()


# --- demo order cards -------------------------------------------------------- #

LIST_CACHE_TTL_S = 60.0
_list_cache: dict[int, tuple[float, dict[str, Any]]] = {}


def _email_allowlist() -> frozenset[str]:
    raw = get_settings().order_sample_email_domains
    return frozenset(d.strip().lower() for d in raw.split(",") if d.strip())


async def list_live_orders(limit: int = 10) -> dict[str, Any]:
    """Newest sandbox orders for the demo page. Never raises; cached 60 s."""
    if not orders_enabled():
        return {"enabled": False, "orders": []}
    hit = _list_cache.get(limit)
    if hit and time.monotonic() - hit[0] < LIST_CACHE_TTL_S:
        return hit[1]
    try:
        orders = await get_client().list_recent_orders(limit, _email_allowlist())
    except Exception:
        log.warning("Shopify recent-orders list failed; demo cards empty", exc_info=True)
        return {"enabled": True, "orders": [], "error": "unavailable"}
    result = {"enabled": True, "orders": orders}
    _list_cache[limit] = (time.monotonic(), result)
    return result


# Failed-check brake (per warm instance; Vapi calls are signed, so this caps a
# rogue caller guessing order numbers against a known postcode/email).
FAIL_WINDOW_S = 900.0
MAX_FAILS_PER_ORDER = 5
MAX_FAILS_TOTAL = 50
_fails: dict[str, deque[float]] = {}
_fails_total: deque[float] = deque()


def _recent(times: deque[float], now: float) -> int:
    while times and now - times[0] > FAIL_WINDOW_S:
        times.popleft()
    return len(times)


def _blocked(number: str, now: float) -> bool:
    per_order = _recent(_fails.setdefault(number, deque()), now)
    return per_order >= MAX_FAILS_PER_ORDER or _recent(_fails_total, now) >= MAX_FAILS_TOTAL


def _record_failure(number: str, now: float) -> None:
    _fails.setdefault(number, deque()).append(now)
    _fails_total.append(now)
    if len(_fails) > 5000:  # bound memory; old entries matter less than staying up
        _fails.clear()


def reset_limits() -> None:
    _fails.clear()
    _fails_total.clear()


def _result(status: str, order: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"status": status, "order": order}


async def get_order_status(
    order_number: str, *, email: str | None = None, postcode: str | None = None
) -> dict[str, Any]:
    if not orders_enabled():
        return _result("disabled")
    number = parse_order_number(order_number)
    if number is None:
        return _result("invalid_order_number")
    if not ((email or "").strip() or (postcode or "").strip()):
        return _result("needs_verification")

    # Only postcode checks are guessable (a few thousand values), so only postcode
    # misses count. Once an order is braked, the postcode is ignored and only the
    # email can prove ownership — a stranger can't lock the real owner out.
    now = time.monotonic()
    if _blocked(number, now):
        if not (email or "").strip():
            log.warning("order #%s: too many failed postcode checks — refusing for now", number)
            return _result("too_many_attempts")
        postcode = None

    try:
        raw = await get_client().find_order(number)
    except Exception:  # an order-system outage must never break a call
        log.warning("Shopify order lookup failed for #%s; continuing without it", number,
                    exc_info=True)
        return _result("unavailable")

    if raw is None or not verify_caller(raw, email=email, postcode=postcode):
        if (postcode or "").strip():
            _record_failure(number, now)
        log.info("order #%s: not found or caller details did not match", number)
        return _result("not_found")
    return _result("ok", map_order(raw))
