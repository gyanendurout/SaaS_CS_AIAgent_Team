"""Shopify Storefront GraphQL client for product lookups (read-only).

Ported from the Shopify chatbot's ShopifyService (retry on transient errors,
product mapping, test/GovX exclusion, title de-dupe) but searches per query
with Shopify's title filter instead of downloading the whole catalogue — a
full download costs ~2 s on every Vercel cold start, while a title search is
~0.3-0.45 s and far more precise than Shopify's free-text ranking.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx

log = logging.getLogger(__name__)

PRODUCTS_QUERY = """
query Products($q: String!, $first: Int!) {
  products(first: $first, query: $q, sortKey: RELEVANCE) {
    nodes {
      title
      handle
      onlineStoreUrl
      availableForSale
      variants(first: 20) {
        nodes {
          title
          availableForSale
          price { amount }
          compareAtPrice { amount }
        }
      }
    }
  }
}
"""

# Words that carry no product meaning (from the chatbot's STOP_WORDS, plus
# stock/price phrasing that callers use around a product name).
_STOP_WORDS_TEXT = """
    show find get want need looking look tell give see know have has had please can
    could would should do does did is are was were be am the a an i me my you your it
    its this that these those there here any some what whats which who how much many
    for on in of to at by with from about and or best better good great top nice ideal
    perfect right suitable suited recommend recommended recommendation suggest favourite
    favorite popular quality worth stock available availability price prices priced cost
    costs sell selling sold buy still left currently right now today we us our carry
    joola
"""
# "joola" is a stop word because every product is JOOLA's but ~30% of titles
# (all iPONG items, some Ben Johns paddles, add-ons) don't contain the word.
STOP_WORDS = frozenset(_STOP_WORDS_TEXT.split())

_PRO_NUMBERS = {"1": "i", "one": "i", "2": "ii", "two": "ii", "3": "iii", "three": "iii",
                "4": "iv", "four": "iv", "5": "v", "five": "v", "vee": "v"}

# Titles write thickness as one token (10mm 12mm 14mm 16mm 18mm 25mm); speech-to-text
# gives "16 mm", "16 millimeter", "sixteen millimeters".
_NUMBER_WORDS = {"ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
                 "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
                 "eighteen": "18", "twenty five": "25", "twenty": "20"}
_UNIT = r"(?:mm|millimet(?:er|re)s?)\b"
_SPOKEN_NUMBER = re.compile(
    r"\b(" + "|".join(sorted(_NUMBER_WORDS, key=len, reverse=True)) + r")\s+(?=" + _UNIT + ")"
)
_THICKNESS = re.compile(r"\b(\d+)\s*" + _UNIT)
_PUNCT = re.compile(r"[^\w\s]")
# Straight and curly (U+2019) apostrophes: "joola's" -> "joola", "don't" -> "dont",
# so a possessive never becomes a stray "s"/"t" keyword.
_POSSESSIVE = re.compile(r"['’]s\b")  # noqa: RUF001
_APOSTROPHE = re.compile(r"['’]")  # noqa: RUF001
MAX_KEYWORDS = 6
_EXCLUDED = re.compile(
    r"(?<![a-z0-9])test(?![a-z0-9])|govx|(?<![a-z0-9])sample(?![a-z0-9])", re.IGNORECASE
)
_TRANSIENT = ("internal error", "throttled", "timeout", "temporarily")
MIN_DISCOUNT_RATIO = 0.01


def extract_keywords(query: str) -> list[str]:
    """Lower-case product words; spoken 'pro five' becomes 'pro v'. Deduplicated, capped."""
    text = _APOSTROPHE.sub("", _POSSESSIVE.sub("", query.lower()))
    text = _PUNCT.sub(" ", text)
    text = _SPOKEN_NUMBER.sub(lambda m: _NUMBER_WORDS[m.group(1)] + " ", text)
    text = _THICKNESS.sub(r"\1mm", text)
    out: list[str] = []
    for word in text.split():
        if out and out[-1] == "pro" and word in _PRO_NUMBERS:
            word = _PRO_NUMBERS[word]
        elif word in STOP_WORDS:
            continue
        if word not in out:
            out.append(word)
    return out[:MAX_KEYWORDS]


def title_query(keywords: list[str]) -> str:
    """Every keyword must prefix-match a word in the product title."""
    return " AND ".join(f"title:{k}*" for k in keywords)


def _amount(money: dict[str, Any] | None) -> float | None:
    try:
        return float(money["amount"]) if money and money.get("amount") is not None else None
    except (TypeError, ValueError):
        return None


def _on_sale(price: float | None, compare: float | None) -> bool:
    return bool(price and compare and compare - price >= compare * MIN_DISCOUNT_RATIO)


def map_product(raw: dict[str, Any]) -> dict[str, Any]:
    variants = [
        {
            "title": v.get("title"),
            "available": bool(v.get("availableForSale")),
            "price": _amount(v.get("price")),
            "compare_at_price": _amount(v.get("compareAtPrice")),
        }
        for v in (raw.get("variants") or {}).get("nodes") or []
    ]
    # Headline price = cheapest variant a customer can actually buy (else cheapest overall).
    priced = [v for v in variants if v["price"] is not None]
    pool = [v for v in priced if v["available"]] or priced
    headline = min(pool, key=lambda v: v["price"]) if pool else {"price": None, "compare_at_price": None}
    available = raw.get("availableForSale")
    if available is None:
        available = any(v["available"] for v in variants)
    return {
        "title": raw.get("title"),
        "url": raw.get("onlineStoreUrl"),
        "price": headline["price"],
        "compare_at_price": headline["compare_at_price"],
        "on_sale": _on_sale(headline["price"], headline["compare_at_price"]),
        "available": bool(available),
        "variants": variants,
        "closest_match": False,
    }


class StorefrontClient:
    def __init__(
        self,
        *,
        store: str,
        token: str,
        api_version: str,
        timeout: float = 4.0,
        attempts: int = 2,
        retry_delay: float = 0.3,
        deadline: float = 4.5,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = f"https://{store}/api/{api_version}/graphql.json"
        self._headers = {"X-Shopify-Storefront-Access-Token": token}
        self._timeout = timeout
        self._attempts = attempts
        self._retry_delay = retry_delay
        self._deadline = deadline
        self._transport = transport
        self._http: httpx.AsyncClient | None = None
        self._http_loop: asyncio.AbstractEventLoop | None = None

    def _client(self) -> httpx.AsyncClient:
        """One pooled keep-alive client per event loop (as the chatbot did).

        A new client per lookup meant a new TLS handshake each time; QA measured
        20 concurrent lookups at ~4.3 s that way vs ~0.2 s with a shared pool.
        """
        loop = asyncio.get_running_loop()
        if self._http is None or self._http.is_closed or self._http_loop is not loop:
            self._http = httpx.AsyncClient(
                timeout=self._timeout,
                headers=self._headers,
                transport=self._transport,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
            self._http_loop = loop
        return self._http

    async def aclose(self) -> None:
        if self._http is not None and not self._http.is_closed:
            await self._http.aclose()

    async def search(self, keywords: list[str], limit: int) -> list[dict[str, Any]]:
        """Exact (all words) first; if 3+ words find nothing, retry once without the
        last word to offer the closest product. One deadline covers everything, so
        retries and the fallback never outlive the API's 5 s cap on live calls."""
        async with asyncio.timeout(self._deadline):
            results = await self._search_once(keywords, limit)
            if not results and len(keywords) >= 3:
                relaxed = await self._search_once(keywords[:-1], limit)
                if relaxed:
                    log.info("no exact product for %s; offering closest match without %r",
                             keywords, keywords[-1])
                # The dropped word may be the one that tells models apart (e.g. "iii"),
                # so the assistant must not quote these as the product asked for.
                results = [{**p, "closest_match": True} for p in relaxed]
            return results

    async def _search_once(self, keywords: list[str], limit: int) -> list[dict[str, Any]]:
        # Over-fetch so exclusions and duplicate titles don't leave us short.
        data = await self._graphql({"q": title_query(keywords), "first": min(limit * 3, 30)})
        results: list[dict[str, Any]] = []
        seen: set[str] = set()
        for node in (data.get("products") or {}).get("nodes") or []:
            title = str(node.get("title") or "")
            if _EXCLUDED.search(title) or _EXCLUDED.search(str(node.get("handle") or "")):
                continue
            if title.lower() in seen:
                continue
            seen.add(title.lower())
            results.append(map_product(node))
            if len(results) == limit:
                break
        return results

    async def _graphql(self, variables: dict[str, Any]) -> dict[str, Any]:
        for attempt in range(1, self._attempts + 1):
            try:
                return await self._graphql_once(variables)
            except (RuntimeError, httpx.TransportError) as error:
                transient = isinstance(error, httpx.TransportError) or any(
                    m in str(error).lower() for m in _TRANSIENT
                )
                if not transient or attempt == self._attempts:
                    raise
                log.warning("Shopify query failed (attempt %d), retrying: %s", attempt, error)
                await asyncio.sleep(self._retry_delay * attempt)
        raise AssertionError("unreachable")

    async def _graphql_once(self, variables: dict[str, Any]) -> dict[str, Any]:
        response = await self._client().post(
            self._url, json={"query": PRODUCTS_QUERY, "variables": variables}
        )
        if response.status_code in (429, 430) or response.status_code >= 500:
            raise RuntimeError(f"Shopify temporarily unavailable (HTTP {response.status_code})")
        response.raise_for_status()  # 4xx (bad token, bad query): not worth retrying
        body = response.json()
        if body.get("errors"):
            messages = "; ".join(
                e.get("message", str(e)) if isinstance(e, dict) else str(e) for e in body["errors"]
            )
            raise RuntimeError(f"Shopify GraphQL error: {messages}")
        data = body.get("data")
        if data is None:
            raise RuntimeError("Shopify GraphQL response contained no data")
        return dict(data)
