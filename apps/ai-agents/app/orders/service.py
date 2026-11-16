"""Gated live order status used by /tools/get_order_status (voice) and future channels.

Lookup is by order number OR email — either one is enough (owner decision 2026-11-16;
no ZIP / second check). A valid order number wins; otherwise the email is used.

Never raises. Outcomes (``status``):
  disabled                     ORDER_SOURCE=off or credentials missing (original behaviour)
  needs_order_number_or_email  neither given — Shopify is not called
  invalid_order_number         order number given (fewer than 3 / more than 10 digits), no email
  invalid_email                email not a plain address (quotes, spaces, brackets...) — not sent
  not_found                    no such order / no orders for that email
  unavailable                  Shopify failed
  ok                           ``order`` = the order (by email: the newest), status-only view;
                               ``other_orders`` = up to 2 more order numbers for that email
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.config import get_settings
from app.orders.admin import AdminClient, map_order, parse_email, parse_order_number

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


MORE_ORDERS = 2


def _result(status: str, order: dict[str, Any] | None = None,
            other_orders: list[str] | None = None) -> dict[str, Any]:
    return {"status": status, "order": order, "other_orders": other_orders or []}


async def get_order_status(
    order_number: str | None, *, email: str | None = None
) -> dict[str, Any]:
    if not orders_enabled():
        return _result("disabled")
    number = parse_order_number(order_number or "")
    has_email = bool((email or "").strip())
    if number is None and not has_email:
        return _result("invalid_order_number" if (order_number or "").strip()
                       else "needs_order_number_or_email")
    address = None
    if number is None:
        address = parse_email(email)
        if address is None:
            return _result("invalid_email")

    try:
        client = get_client()
        if number is not None:
            raw = await client.find_order(number)
            found = [raw] if raw else []
        else:
            found = await client.find_orders_by_email(address, MORE_ORDERS + 1)  # type: ignore[arg-type]
    except Exception:  # an order-system outage must never break a call
        log.warning("Shopify order lookup failed (%s); continuing without it",
                    f"#{number}" if number else "by email", exc_info=True)
        return _result("unavailable")

    if not found:
        log.info("order lookup %s: not found", f"#{number}" if number else "by email")
        return _result("not_found")
    return _result("ok", map_order(found[0]), [str(o.get("name")) for o in found[1:]])
