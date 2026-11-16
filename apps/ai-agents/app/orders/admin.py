"""Shopify Admin GraphQL client for order status (read-only).

Uses the dedicated ``JOOLA CS Agent`` app on the Team JOOLA sandbox store. The
token comes from the client-credentials grant (valid ~24 h) and is cached until
shortly before it expires; a 401 refreshes it once.

The order-number rule (3+ digits, optional ``#``) and the order/tracking field
mapping are ported from the chatbot's ``order_service.py``. Lookup is by order
number OR email (owner decision 2026-11-16 — no second check, no ZIP); addresses
are not fetched at all, and the email is only used to match orders, never returned.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

import httpx

log = logging.getLogger(__name__)

ORDER_QUERY = """
query OrderStatus($q: String!) {
  orders(first: 5, query: $q) {
    nodes {
      name
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      lineItems(first: 20) { nodes { title quantity } }
      fulfillments(first: 10) {
        displayStatus
        trackingInfo(first: 5) { company number url }
      }
      returns(first: 5) { nodes { name status } }
    }
  }
}
"""

# A customer's orders by email, newest first. Shopify's search can be loose, so the
# email is fetched only to keep exact matches; it is never returned to callers.
EMAIL_QUERY = """
query OrdersByEmail($q: String!) {
  orders(first: 10, query: $q, sortKey: CREATED_AT, reverse: true) {
    nodes {
      name
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      email
      lineItems(first: 20) { nodes { title quantity } }
      fulfillments(first: 10) {
        displayStatus
        trackingInfo(first: 5) { company number url }
      }
      returns(first: 5) { nodes { name status } }
    }
  }
}
"""

# Demo order cards: newest first, no addresses requested at all.
LIST_QUERY = """
query RecentOrders($first: Int!) {
  orders(first: $first, sortKey: CREATED_AT, reverse: true) {
    nodes {
      name
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      email
      lineItems(first: 20) { nodes { title quantity } }
      fulfillments(first: 10) {
        displayStatus
        trackingInfo(first: 5) { company number url }
      }
      returns(first: 5) { nodes { name status } }
    }
  }
}
"""
MAX_LIST = 20

_TRANSIENT = ("throttled", "internal error", "timeout", "temporarily unavailable")
_TOKEN_REFRESH_MARGIN_S = 300.0
_MAX_DIGITS = 10


def parse_order_number(spoken: str) -> str | None:
    """Digits of the order number ("#5301", "order 53 01", "JL-5301" -> "5301")."""
    digits = re.sub(r"\D", "", spoken or "")
    return digits if 3 <= len(digits) <= _MAX_DIGITS else None


# Plain addresses only: no quotes, spaces, brackets or backslashes, so the value can be
# placed inside Shopify's search syntax without changing the query.
_SAFE_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")


def parse_email(value: str | None) -> str | None:
    """Lower-cased email if it is a plain, safe address; otherwise None."""
    text = (value or "").strip().lower()
    return text if len(text) <= 254 and _SAFE_EMAIL.fullmatch(text) else None


def mask_email(email: str | None, *, allow: frozenset[str]) -> str | None:
    """Full email if its domain is allow-listed (or allow has "*"), else "p***@g***.com"."""
    value = (email or "").strip()
    if value.count("@") != 1:
        return None
    local, domain = value.split("@")
    if not local or not domain:
        return None
    if "*" in allow or domain.lower() in allow:
        return value
    labels = domain.split(".")
    tail = f".{labels[-1]}" if len(labels) > 1 else ""
    return f"{local[0]}***@{labels[0][:1]}***{tail}"


def map_order(raw: dict[str, Any]) -> dict[str, Any]:
    """Status-only view: no email, address, phone or payment details."""
    shipments = []
    for fulfillment in raw.get("fulfillments") or []:
        infos = fulfillment.get("trackingInfo") or [{}]
        for info in infos:
            shipments.append({
                "status": fulfillment.get("displayStatus"),
                "carrier": info.get("company"),
                "tracking_number": info.get("number"),
                "tracking_url": info.get("url"),
            })
    return {
        "order_number": raw.get("name"),
        "placed_on": str(raw.get("createdAt") or "")[:10] or None,
        "payment_status": raw.get("displayFinancialStatus"),
        "fulfillment_status": raw.get("displayFulfillmentStatus"),
        "cancelled": bool(raw.get("cancelledAt")),
        "items": [
            {"title": item.get("title"), "quantity": item.get("quantity")}
            for item in (raw.get("lineItems") or {}).get("nodes") or []
        ],
        "shipments": shipments,
        "returns": [
            {"name": r.get("name"), "status": r.get("status")}
            for r in (raw.get("returns") or {}).get("nodes") or []
        ],
    }


class AdminClient:
    def __init__(
        self,
        *,
        store: str,
        client_id: str,
        client_secret: str,
        api_version: str,
        timeout: float = 4.0,
        attempts: int = 2,
        retry_delay: float = 0.3,
        deadline: float = 4.5,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base = f"https://{store}"
        self._graphql_url = f"{self._base}/admin/api/{api_version}/graphql.json"
        self._client_id = client_id
        self._client_secret = client_secret
        self._timeout = timeout
        self._attempts = attempts
        self._retry_delay = retry_delay
        self._deadline = deadline
        self._transport = transport
        self._http: httpx.AsyncClient | None = None
        self._http_loop: asyncio.AbstractEventLoop | None = None
        self._token: str | None = None
        self._token_expires = 0.0

    def _client(self) -> httpx.AsyncClient:
        """One pooled keep-alive client per event loop (same as the Storefront client)."""
        loop = asyncio.get_running_loop()
        if self._http is None or self._http.is_closed or self._http_loop is not loop:
            self._http = httpx.AsyncClient(
                timeout=self._timeout,
                transport=self._transport,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
            self._http_loop = loop
        return self._http

    async def _access_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires:
            return self._token
        response = await self._client().post(
            f"{self._base}/admin/oauth/access_token",
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
        )
        response.raise_for_status()
        body = response.json()
        self._token = str(body["access_token"])
        lifetime = float(body.get("expires_in") or 3600)
        self._token_expires = time.monotonic() + max(lifetime - _TOKEN_REFRESH_MARGIN_S, 60.0)
        return self._token

    async def find_order(self, number: str) -> dict[str, Any] | None:
        """The order named exactly ``#<number>``, or None."""
        async with asyncio.timeout(self._deadline):
            data = await self._graphql(ORDER_QUERY, {"q": f"name:#{number}"})
        for node in (data.get("orders") or {}).get("nodes") or []:
            # Digits only, so a store order prefix/suffix (e.g. "#JL5301") still matches.
            if re.sub(r"\D", "", str(node.get("name") or "")) == number:
                return dict(node)
        return None

    async def find_orders_by_email(self, email: str, limit: int) -> list[dict[str, Any]]:
        """Newest orders whose email is exactly ``email`` (already validated by parse_email)."""
        async with asyncio.timeout(self._deadline):
            data = await self._graphql(EMAIL_QUERY, {"q": f'email:"{email}"'})
        nodes = (data.get("orders") or {}).get("nodes") or []
        exact = [dict(n) for n in nodes if str(n.get("email") or "").strip().lower() == email]
        return exact[:limit]

    async def list_recent_orders(self, limit: int, allow: frozenset[str]) -> list[dict[str, Any]]:
        """Newest orders, status-only, with a masked email hint (demo order cards)."""
        first = max(1, min(int(limit), MAX_LIST))
        async with asyncio.timeout(self._deadline):
            data = await self._graphql(LIST_QUERY, {"first": first})
        return [
            {**map_order(node), "email_hint": mask_email(node.get("email"), allow=allow)}
            for node in (data.get("orders") or {}).get("nodes") or []
        ]

    async def _graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        refreshed = False
        attempt = 1
        while True:
            try:
                return await self._graphql_once(query, variables)
            except httpx.HTTPStatusError as error:
                if error.response.status_code == 401 and not refreshed:
                    self._token = None  # expired or revoked: fetch a new one once
                    refreshed = True
                    continue
                raise
            except (RuntimeError, httpx.TransportError) as error:
                transient = isinstance(error, httpx.TransportError) or any(
                    m in str(error).lower() for m in _TRANSIENT
                )
                if not transient or attempt >= self._attempts:
                    raise
                log.warning("Shopify Admin query failed (attempt %d), retrying: %s", attempt, error)
                await asyncio.sleep(self._retry_delay * attempt)
                attempt += 1

    async def _graphql_once(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        token = await self._access_token()
        response = await self._client().post(
            self._graphql_url,
            json={"query": query, "variables": variables},
            headers={"X-Shopify-Access-Token": token},
        )
        if response.status_code in (429, 430) or response.status_code >= 500:
            raise RuntimeError(f"Shopify temporarily unavailable (HTTP {response.status_code})")
        response.raise_for_status()
        body = response.json()
        if body.get("errors"):
            messages = "; ".join(
                e.get("message", str(e)) if isinstance(e, dict) else str(e) for e in body["errors"]
            )
            if "access denied" in messages.lower() or "access_denied" in str(body["errors"]).lower():
                log.error("Shopify denied order fields — check the app has read_orders and "
                          "protected customer data access (email, address)")
            raise RuntimeError(f"Shopify GraphQL error: {messages}")
        data = body.get("data")
        if data is None:
            raise RuntimeError("Shopify GraphQL response contained no data")
        return dict(data)
