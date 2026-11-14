"""Tests for live Shopify Admin order status (app/orders).

Offline: Shopify is replaced by httpx.MockTransport. ORDER_SOURCE defaults to
``off``; tests switch it on via ``orders_on``. All data is synthetic.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.orders import service
from app.orders.admin import (
    AdminClient,
    map_order,
    mask_email,
    parse_order_number,
    verify_caller,
)


@pytest.fixture(autouse=True)
def _fresh():
    get_settings.cache_clear()
    service.reset_client()
    service.reset_limits()
    yield
    get_settings.cache_clear()
    service.reset_client()
    service.reset_limits()


@pytest.fixture
def orders_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORDER_SOURCE", "shopify")
    monkeypatch.setenv("SHOPIFY_STORE", "test-store.myshopify.com")
    monkeypatch.setenv("SHOPIFY_ADMIN_CLIENT_ID", "client-id-test")
    monkeypatch.setenv("SHOPIFY_ADMIN_CLIENT_SECRET", "client-secret-test")
    get_settings.cache_clear()


def _order(name: str = "#5301", email: str = "pat@example.test", zip_code: str = "20852") -> dict:
    return {
        "name": name,
        "createdAt": "2026-10-02T15:04:05Z",
        "cancelledAt": None,
        "displayFinancialStatus": "PAID",
        "displayFulfillmentStatus": "FULFILLED",
        "email": email,
        "shippingAddress": {"zip": zip_code},
        "billingAddress": {"zip": "99999"},
        "lineItems": {"nodes": [{"title": "Perseus 16mm", "quantity": 1, "sku": "PER-16"}]},
        "fulfillments": [
            {
                "displayStatus": "DELIVERED",
                "trackingInfo": [{"company": "UPS", "number": "1Z999", "url": "https://ups.test/1Z999"}],
            }
        ],
        "returns": {"nodes": [{"name": "#5301-R1", "status": "OPEN"}]},
    }


class _Shopify:
    """Fake Shopify: token endpoint + Admin GraphQL, records requests."""

    def __init__(self, orders: list[dict] | None = None, graphql_status: int = 200) -> None:
        self.orders = [_order()] if orders is None else orders
        self.graphql_status = graphql_status
        self.token_calls = 0
        self.queries: list[dict[str, Any]] = []
        self.tokens_seen: list[str] = []
        self.query_texts: list[str] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/admin/oauth/access_token":
            self.token_calls += 1
            form = dict(httpx.QueryParams(request.content.decode()))
            assert form == {
                "grant_type": "client_credentials",
                "client_id": "client-id-test",
                "client_secret": "client-secret-test",
            }
            return httpx.Response(200, json={"access_token": f"tok-{self.token_calls}", "expires_in": 86399})
        assert request.url.path == "/admin/api/2026-07/graphql.json"
        self.tokens_seen.append(request.headers["X-Shopify-Access-Token"])
        payload = json.loads(request.content)
        self.queries.append(payload["variables"])
        self.query_texts.append(payload["query"])
        if self.graphql_status != 200:
            status, self.graphql_status = self.graphql_status, 200
            return httpx.Response(status)
        return httpx.Response(200, json={"data": {"orders": {"nodes": self.orders}}})


def _client(fake: _Shopify) -> AdminClient:
    return AdminClient(
        store="test-store.myshopify.com",
        client_id="client-id-test",
        client_secret="client-secret-test",
        api_version="2026-07",
        retry_delay=0,
        transport=httpx.MockTransport(fake),
    )


# ---- order number parsing (copied rule from the chatbot: 3+ digits) -------- #


@pytest.mark.parametrize(
    "spoken, expected",
    [("5301", "5301"), ("#5301", "5301"), ("order 5301", "5301"), ("53 01", "5301"),
     ("JL-5301", "5301"), ("12", None), ("", None), ("abc", None), ("12345678901", None)],
)
def test_parse_order_number(spoken: str, expected: str | None) -> None:
    assert parse_order_number(spoken) == expected


# ---- caller check --------------------------------------------------------- #


def test_email_match_is_case_and_space_insensitive() -> None:
    assert verify_caller(_order(), email="  PAT@Example.TEST ", postcode=None)


def test_postcode_matches_shipping_or_billing_and_zip_plus_four() -> None:
    assert verify_caller(_order(), email=None, postcode="20852-1234")
    assert verify_caller(_order(), email=None, postcode="99999")


def test_wrong_or_missing_details_fail() -> None:
    assert not verify_caller(_order(), email="someone@else.test", postcode=None)
    assert not verify_caller(_order(), email=None, postcode="11111")
    assert not verify_caller(_order(), email=None, postcode=None)
    # Shopify without protected-data access returns nulls — never a match.
    hidden = {**_order(), "email": None, "shippingAddress": None, "billingAddress": None}
    assert not verify_caller(hidden, email="", postcode="")


# ---- mapping never exposes personal data ---------------------------------- #


def test_map_order_keeps_status_and_drops_personal_data() -> None:
    mapped = map_order(_order())
    assert mapped == {
        "order_number": "#5301",
        "placed_on": "2026-10-02",
        "payment_status": "PAID",
        "fulfillment_status": "FULFILLED",
        "cancelled": False,
        "items": [{"title": "Perseus 16mm", "quantity": 1}],
        "shipments": [{"status": "DELIVERED", "carrier": "UPS", "tracking_number": "1Z999",
                       "tracking_url": "https://ups.test/1Z999"}],
        "returns": [{"name": "#5301-R1", "status": "OPEN"}],
    }
    text = json.dumps(mapped)
    assert "pat@example.test" not in text and "20852" not in text


# ---- client ---------------------------------------------------------------- #


async def test_token_is_fetched_once_and_reused() -> None:
    fake = _Shopify()
    client = _client(fake)
    await client.find_order("5301")
    await client.find_order("5301")
    assert fake.token_calls == 1
    assert fake.tokens_seen == ["tok-1", "tok-1"]
    assert fake.queries[0] == {"q": "name:#5301"}


async def test_expired_token_401_refreshes_once() -> None:
    fake = _Shopify(graphql_status=401)
    order = await _client(fake).find_order("5301")
    assert order is not None and order["name"] == "#5301"
    assert fake.token_calls == 2 and fake.tokens_seen == ["tok-1", "tok-2"]


async def test_only_exact_order_name_is_returned() -> None:
    fake = _Shopify(orders=[_order(name="#53010"), _order(name="#5301")])
    order = await _client(fake).find_order("5301")
    assert order is not None and order["name"] == "#5301"
    assert await _client(_Shopify(orders=[_order(name="#53010")])).find_order("5301") is None


async def test_server_error_is_retried() -> None:
    fake = _Shopify(graphql_status=503)
    assert await _client(fake).find_order("5301") is not None
    assert len(fake.queries) == 2


# ---- service gate + outcomes ----------------------------------------------- #


async def test_disabled_by_default() -> None:
    assert not service.orders_enabled()
    assert (await service.get_order_status("5301", email="pat@example.test"))["status"] == "disabled"


async def test_unknown_flag_falls_back_to_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORDER_SOURCE", "shopfy")
    get_settings.cache_clear()
    assert get_settings().order_source == "off"


async def test_enabled_needs_credentials(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    assert service.orders_enabled()
    monkeypatch.setenv("SHOPIFY_ADMIN_CLIENT_SECRET", "")
    get_settings.cache_clear()
    assert not service.orders_enabled()


def _use(monkeypatch: pytest.MonkeyPatch, fake: _Shopify) -> None:
    monkeypatch.setattr(service, "get_client", lambda: _client(fake))


async def test_verified_caller_gets_order(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, _Shopify())
    result = await service.get_order_status("order 5301", email="pat@example.test")
    assert result["status"] == "ok"
    assert result["order"]["order_number"] == "#5301"


async def test_needs_verification_before_any_lookup(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _Shopify()
    _use(monkeypatch, fake)
    result = await service.get_order_status("5301")
    assert result == {"status": "needs_verification", "order": None}
    assert fake.queries == []


async def test_mismatch_looks_like_not_found(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    """A wrong email must not reveal that the order exists."""
    _use(monkeypatch, _Shopify())
    wrong = await service.get_order_status("5301", email="someone@else.test")
    _use(monkeypatch, _Shopify(orders=[]))
    missing = await service.get_order_status("5301", email="pat@example.test")
    assert wrong == missing == {"status": "not_found", "order": None}


async def test_bad_number_and_outage(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    assert (await service.get_order_status("12", email="pat@example.test"))["status"] == "invalid_order_number"

    class _Down:
        async def find_order(self, number: str) -> dict:
            raise httpx.ConnectError("down")

    monkeypatch.setattr(service, "get_client", lambda: _Down())
    assert (await service.get_order_status("5301", email="pat@example.test"))["status"] == "unavailable"


# ---- route ----------------------------------------------------------------- #


def test_route_returns_disabled_when_off() -> None:
    body = TestClient(app).post("/tools/get_order_status", json={"order_number": "5301"}).json()
    assert body == {"enabled": False, "status": "disabled", "order": None}


def test_route_requires_secret_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_AGENTS_SECRET", "s3cret")
    get_settings.cache_clear()
    client = TestClient(app)
    assert client.post("/tools/get_order_status", json={"order_number": "5301"}).status_code == 401
    ok = client.post("/tools/get_order_status", json={"order_number": "5301"},
                     headers={"X-Internal-Secret": "s3cret"})
    assert ok.status_code == 200


def test_route_ok(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, _Shopify())
    body = TestClient(app).post(
        "/tools/get_order_status", json={"order_number": "#5301", "postcode": "20852"}
    ).json()
    assert body["enabled"] is True and body["status"] == "ok"
    assert body["order"]["shipments"][0]["carrier"] == "UPS"


# ---- review fixes ---------------------------------------------------------- #


async def test_prefixed_store_order_names_match_on_digits() -> None:
    order = await _client(_Shopify(orders=[_order(name="#JL5301")])).find_order("5301")
    assert order is not None


async def test_postcode_guessing_is_braked_but_email_still_works(
    orders_on, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Postcodes are guessable, emails are not: only postcode misses count, and the
    real owner can still get in with their email (no lock-out by a stranger)."""
    fake = _Shopify()
    _use(monkeypatch, fake)
    for _ in range(service.MAX_FAILS_PER_ORDER):
        assert (await service.get_order_status("5301", postcode="00000"))["status"] == "not_found"
    blocked = await service.get_order_status("5301", postcode="20852")  # even the right one
    assert blocked == {"status": "too_many_attempts", "order": None}
    assert len(fake.queries) == service.MAX_FAILS_PER_ORDER  # Shopify not called once blocked
    assert (await service.get_order_status("5301", email="pat@example.test"))["status"] == "ok"
    # other order numbers are unaffected
    assert (await service.get_order_status("5302", postcode="00000"))["status"] == "not_found"


async def test_wrong_emails_do_not_lock_the_order(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, _Shopify())
    for _ in range(service.MAX_FAILS_PER_ORDER + 3):
        assert (await service.get_order_status("5301", email="x@y.test"))["status"] == "not_found"
    assert (await service.get_order_status("5301", postcode="20852"))["status"] == "ok"


async def test_global_brake(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "MAX_FAILS_TOTAL", 3)
    _use(monkeypatch, _Shopify(orders=[]))
    for n in ("1001", "1002", "1003"):
        await service.get_order_status(n, postcode="00000")
    assert (await service.get_order_status("1004", postcode="00000"))["status"] == "too_many_attempts"


async def test_old_failures_expire(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, _Shopify())
    clock = [1000.0]
    monkeypatch.setattr(service.time, "monotonic", lambda: clock[0])
    for _ in range(service.MAX_FAILS_PER_ORDER):
        await service.get_order_status("5301", postcode="00000")
    clock[0] += service.FAIL_WINDOW_S + 1
    assert (await service.get_order_status("5301", email="pat@example.test"))["status"] == "ok"


# ---- live order cards (demo) ----------------------------------------------- #

NONE: frozenset[str] = frozenset()


def test_mask_email() -> None:
    assert mask_email("pat.smith@gmail.com", allow=NONE) == "p***@g***.com"
    assert mask_email("qa@joola.com", allow=frozenset({"joola.com"})) == "qa@joola.com"
    assert mask_email("QA@Joola.COM", allow=frozenset({"joola.com"})) == "QA@Joola.COM"
    assert mask_email("pat@gmail.com", allow=frozenset({"*"})) == "pat@gmail.com"
    assert mask_email("a@b", allow=NONE) == "a***@b***"
    assert mask_email("x@mail.co.uk", allow=NONE) == "x***@m***.uk"
    assert mask_email(None, allow=NONE) is None
    assert mask_email("not-an-email", allow=NONE) is None
    assert mask_email("  ", allow=NONE) is None


async def test_list_recent_orders_maps_and_masks() -> None:
    fake = _Shopify(orders=[_order(name="#5301"), _order(name="#5300", email="qa@joola.com")])
    rows = await _client(fake).list_recent_orders(limit=2, allow=frozenset({"joola.com"}))
    assert [r["order_number"] for r in rows] == ["#5301", "#5300"]
    assert rows[0]["email_hint"] == "p***@e***.test"
    assert rows[1]["email_hint"] == "qa@joola.com"
    assert rows[0]["fulfillment_status"] == "FULFILLED"
    assert "20852" not in json.dumps(rows)  # postcodes never leave
    assert fake.queries == [{"first": 2}]
    assert "sortKey: CREATED_AT" in fake.query_texts[0] and "reverse: true" in fake.query_texts[0]
    assert "Address" not in fake.query_texts[0]  # addresses are not even requested


async def test_list_recent_orders_clamps_limit() -> None:
    fake = _Shopify(orders=[])
    await _client(fake).list_recent_orders(limit=500, allow=NONE)
    await _client(fake).list_recent_orders(limit=0, allow=NONE)
    assert fake.queries == [{"first": 20}, {"first": 1}]


async def test_live_orders_disabled_by_default() -> None:
    assert await service.list_live_orders() == {"enabled": False, "orders": []}


async def test_live_orders_lists_and_caches(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORDER_SAMPLE_EMAIL_DOMAINS", " Joola.com , example.test ")
    get_settings.cache_clear()
    fake = _Shopify()
    _use(monkeypatch, fake)
    first = await service.list_live_orders(limit=5)
    second = await service.list_live_orders(limit=5)
    assert first == second
    assert first["enabled"] is True and first["orders"][0]["email_hint"] == "pat@example.test"
    assert len(fake.queries) == 1  # cached
    service.reset_client()
    await service.list_live_orders(limit=5)
    assert len(fake.queries) == 2


async def test_live_orders_outage(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    class _Down:
        async def list_recent_orders(self, limit: int, allow: frozenset[str]) -> list:
            raise httpx.ConnectError("down")

    monkeypatch.setattr(service, "get_client", lambda: _Down())
    assert await service.list_live_orders() == {"enabled": True, "orders": [], "error": "unavailable"}


def test_live_orders_route(orders_on, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, _Shopify())
    client = TestClient(app)
    body = client.post("/tools/live_orders", json={"limit": 3}).json()
    assert body["enabled"] is True and body["orders"][0]["order_number"] == "#5301"
    assert body["orders"][0]["email_hint"] == "p***@e***.test"
    assert client.post("/tools/live_orders", json={"limit": 0}).status_code == 422
    assert client.post("/tools/live_orders", json={"limit": 21}).status_code == 422


def test_live_orders_route_off_and_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    assert client.post("/tools/live_orders", json={}).json() == {"enabled": False, "orders": [], "error": None}
    monkeypatch.setenv("AI_AGENTS_SECRET", "s3cret")
    get_settings.cache_clear()
    assert client.post("/tools/live_orders", json={}).status_code == 401


def test_health_reports_orders_switch(orders_on) -> None:
    assert TestClient(app).get("/health").json()["orders_enabled"] is True
