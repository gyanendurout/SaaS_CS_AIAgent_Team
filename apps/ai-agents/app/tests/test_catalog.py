"""Tests for the Shopify Storefront catalogue connector (app/catalog).

Offline: Shopify is replaced by httpx.MockTransport. The catalogue is switched
on per test via ``catalog_on``; the default must stay ``off``.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.catalog import service
from app.catalog.storefront import (
    StorefrontClient,
    extract_keywords,
    map_product,
    title_query,
)
from app.config import Settings, get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _fresh(monkeypatch: pytest.MonkeyPatch):
    get_settings.cache_clear()
    service.clear_cache()
    yield
    get_settings.cache_clear()
    service.clear_cache()


@pytest.fixture
def catalog_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOG_SOURCE", "shopify")
    monkeypatch.setenv("SHOPIFY_STORE", "test-store.myshopify.com")
    monkeypatch.setenv("SHOPIFY_STOREFRONT_TOKEN", "storefront-test-token")
    get_settings.cache_clear()


def _node(title: str, available: bool = True, price: str = "100.0", compare: str | None = None) -> dict:
    return {
        "title": title,
        "handle": title.lower().replace(" ", "-"),
        "onlineStoreUrl": f"https://joola.com/products/{title.lower().replace(' ', '-')}",
        "availableForSale": available,
        "variants": {
            "nodes": [
                {
                    "title": "Default",
                    "availableForSale": available,
                    "price": {"amount": price},
                    "compareAtPrice": {"amount": compare} if compare else None,
                }
            ]
        },
    }


def _products_response(nodes: list[dict]) -> httpx.Response:
    return httpx.Response(200, json={"data": {"products": {"nodes": nodes}}})


def _client(handler: Any) -> StorefrontClient:
    return StorefrontClient(
        store="test-store.myshopify.com",
        token="storefront-test-token",
        api_version="2026-07",
        transport=httpx.MockTransport(handler),
        retry_delay=0,
    )


# --------------------------------------------------------------------------- #
# Config                                                                       #
# --------------------------------------------------------------------------- #


def test_catalog_defaults_to_off() -> None:
    assert get_settings().catalog_source == "off"


def test_catalog_typo_falls_back_to_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOG_SOURCE", "shopfy")
    assert Settings().catalog_source == "off"  # type: ignore[call-arg]


def test_catalog_value_is_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOG_SOURCE", " Shopify ")
    assert Settings().catalog_source == "shopify"  # type: ignore[call-arg]


# --------------------------------------------------------------------------- #
# Query building                                                               #
# --------------------------------------------------------------------------- #


def test_keywords_drop_filler_words() -> None:
    assert extract_keywords("Is the Perseus 16mm paddle in stock?") == ["perseus", "16mm", "paddle"]


def test_keywords_map_spoken_pro_numbers_to_roman() -> None:
    assert extract_keywords("do you have the perseus pro five") == ["perseus", "pro", "v"]
    assert extract_keywords("Hyperion Pro 4 price") == ["hyperion", "pro", "iv"]


def test_keywords_handle_apostrophes_and_possessives() -> None:
    assert extract_keywords("What's the price of the JOOLA's Perseus?") == ["joola", "perseus"]
    assert extract_keywords("I don’t see the Kosmos") == ["dont", "kosmos"]  # noqa: RUF001


def test_keywords_are_deduplicated_and_capped() -> None:
    assert extract_keywords("perseus perseus pro v") == ["perseus", "pro", "v"]
    assert len(extract_keywords(" ".join(f"word{i}" for i in range(50)))) == 6


def test_keywords_empty_for_pure_filler() -> None:
    assert extract_keywords("is it in stock?") == []


def test_title_query_requires_every_word() -> None:
    assert title_query(["perseus", "16mm"]) == "title:perseus* AND title:16mm*"


# --------------------------------------------------------------------------- #
# Mapping                                                                      #
# --------------------------------------------------------------------------- #


def test_map_product_flags_sale_and_stock() -> None:
    p = map_product(_node("JOOLA Perseus Pro V", price="249.95", compare="299.95"))
    assert p["title"] == "JOOLA Perseus Pro V"
    assert p["price"] == 249.95
    assert p["compare_at_price"] == 299.95
    assert p["on_sale"] is True
    assert p["available"] is True
    assert p["url"].startswith("https://joola.com/products/")
    assert p["variants"] == [
        {"title": "Default", "available": True, "price": 249.95, "compare_at_price": 299.95}
    ]


def test_map_product_headline_price_uses_cheapest_available_variant() -> None:
    raw = _node("Paddle")
    raw["variants"]["nodes"] = [
        {"title": "14mm", "availableForSale": False, "price": {"amount": "299.95"}, "compareAtPrice": None},
        {"title": "16mm", "availableForSale": True, "price": {"amount": "249.95"},
         "compareAtPrice": {"amount": "299.95"}},
    ]
    p = map_product(raw)
    assert p["price"] == 249.95
    assert p["compare_at_price"] == 299.95
    assert p["on_sale"] is True
    assert p["variants"][1] == {
        "title": "16mm", "available": True, "price": 249.95, "compare_at_price": 299.95
    }


def test_map_product_not_on_sale_without_discount() -> None:
    p = map_product(_node("Net", price="98.05"))
    assert p["on_sale"] is False
    assert p["compare_at_price"] is None


# --------------------------------------------------------------------------- #
# Storefront client                                                            #
# --------------------------------------------------------------------------- #


async def test_client_sends_title_query_and_token() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["token"] = request.headers.get("X-Shopify-Storefront-Access-Token")
        seen["body"] = json.loads(request.content)
        return _products_response([_node("JOOLA Perseus 16mm")])

    results = await _client(handler).search(["perseus", "16mm"], limit=3)
    assert [r["title"] for r in results] == ["JOOLA Perseus 16mm"]
    assert seen["url"] == "https://test-store.myshopify.com/api/2026-07/graphql.json"
    assert seen["token"] == "storefront-test-token"
    assert seen["body"]["variables"]["q"] == "title:perseus* AND title:16mm*"
    assert "sortKey: RELEVANCE" in seen["body"]["query"]


async def test_client_retries_network_error() -> None:
    calls = {"n": 0}

    def handler(_r: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("blip")
        return _products_response([_node("JOOLA Kosmos Pro V")])

    results = await _client(handler).search(["kosmos"], limit=5)
    assert calls["n"] == 2
    assert results[0]["title"] == "JOOLA Kosmos Pro V"


async def test_client_respects_overall_deadline() -> None:
    import asyncio
    import time

    async def slow(_r: httpx.Request) -> httpx.Response:
        await asyncio.sleep(2)
        return _products_response([])

    client = StorefrontClient(
        store="s.myshopify.com", token="t", api_version="2026-07",
        transport=httpx.MockTransport(slow), retry_delay=0, deadline=0.2,
    )
    start = time.perf_counter()
    with pytest.raises(TimeoutError):
        await client.search(["kosmos"], limit=5)
    assert time.perf_counter() - start < 1.0


async def test_client_excludes_test_products_and_duplicate_titles() -> None:
    nodes = [
        _node("JOOLA Perseus Pro IV 16mm"),
        _node("JOOLA Perseus Pro IV 16mm", price="132.0"),
        _node("TEST Perseus product"),
        _node("JOOLA Perseus GovX Edition"),
        _node("JOOLA Perseus 3S"),
    ]
    results = await _client(lambda _r: _products_response(nodes)).search(["perseus"], limit=5)
    assert [r["title"] for r in results] == ["JOOLA Perseus Pro IV 16mm", "JOOLA Perseus 3S"]


async def test_client_retries_transient_shopify_error() -> None:
    calls = {"n": 0}

    def handler(_r: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json={"errors": [{"message": "Internal error"}]})
        return _products_response([_node("JOOLA Kosmos Pro V")])

    results = await _client(handler).search(["kosmos"], limit=5)
    assert calls["n"] == 2
    assert results[0]["title"] == "JOOLA Kosmos Pro V"


async def test_client_does_not_retry_auth_failure() -> None:
    calls = {"n": 0}

    def handler(_r: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401, json={"errors": "Unauthorized"})

    with pytest.raises(httpx.HTTPStatusError):
        await _client(handler).search(["kosmos"], limit=5)
    assert calls["n"] == 1


# --------------------------------------------------------------------------- #
# Service (gate + cache)                                                       #
# --------------------------------------------------------------------------- #


async def test_service_disabled_when_off() -> None:
    assert service.catalog_enabled() is False
    assert await service.search_products("perseus") == []


async def test_service_disabled_when_credentials_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOG_SOURCE", "shopify")
    monkeypatch.setenv("SHOPIFY_STORE", "")
    monkeypatch.setenv("SHOPIFY_STOREFRONT_TOKEN", "")
    get_settings.cache_clear()
    assert service.catalog_enabled() is False


async def test_service_caches_repeat_queries(catalog_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    def handler(_r: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return _products_response([_node("JOOLA Perseus 16mm")])

    monkeypatch.setattr(service, "get_client", lambda: _client(handler))
    first = await service.search_products("Is the Perseus 16mm in stock?")
    second = await service.search_products("perseus 16mm")
    assert first == second
    assert first[0]["title"] == "JOOLA Perseus 16mm"
    assert calls["n"] == 1


async def test_service_cache_is_bounded(catalog_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "get_client", lambda: _client(lambda _r: _products_response([])))
    for i in range(service.CACHE_MAX + 10):
        await service.search_products(f"product{i}")
    assert len(service._cache) <= service.CACHE_MAX


async def test_service_skips_shopify_for_filler_only_query(
    catalog_on: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(_r: httpx.Request) -> httpx.Response:
        raise AssertionError("Shopify must not be called")

    monkeypatch.setattr(service, "get_client", lambda: _client(handler))
    assert await service.search_products("is it in stock?") == []


async def test_service_never_raises(catalog_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("shopify down")

    monkeypatch.setattr(service, "get_client", lambda: _client(handler))
    assert await service.search_products("perseus") == []


# --------------------------------------------------------------------------- #
# /tools/search_products                                                       #
# --------------------------------------------------------------------------- #


def test_endpoint_reports_disabled_when_off() -> None:
    with TestClient(app) as c:
        r = c.post("/tools/search_products", json={"query": "perseus"})
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "results": []}


def test_endpoint_returns_products_when_on(catalog_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    product = map_product(_node("JOOLA Perseus 16mm"))

    async def fake_search(query: str, limit: int = 5) -> list[dict[str, Any]]:
        return [product]

    import app.routes.tools as tools_mod

    monkeypatch.setattr(tools_mod, "search_products", fake_search)
    with TestClient(app) as c:
        r = c.post("/tools/search_products", json={"query": "perseus 16mm"})
    assert r.status_code == 200
    assert r.json() == {"enabled": True, "results": [product]}


def test_endpoint_rejects_empty_query() -> None:
    with TestClient(app) as c:
        r = c.post("/tools/search_products", json={"query": ""})
    assert r.status_code == 422
