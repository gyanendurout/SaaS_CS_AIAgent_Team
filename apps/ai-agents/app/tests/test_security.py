"""Shared-secret protection of the paid tool endpoints, and /health feature flags."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

PAID = ("/tools/search_knowledge", "/tools/search_products")
SECRET = "s3cret-for-tests-only-0123456789"


@pytest.fixture(autouse=True)
def _fresh():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def secret_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_AGENTS_SECRET", SECRET)
    get_settings.cache_clear()


@pytest.mark.parametrize("path", PAID)
def test_paid_tools_open_when_no_secret_configured(path: str) -> None:
    with TestClient(app) as c:
        assert c.post(path, json={"query": "kosmos"}).status_code == 200


@pytest.mark.parametrize("path", PAID)
def test_paid_tools_reject_missing_secret(secret_set: None, path: str) -> None:
    with TestClient(app) as c:
        r = c.post(path, json={"query": "kosmos"})
    assert r.status_code == 401


@pytest.mark.parametrize("path", PAID)
def test_paid_tools_reject_wrong_secret(secret_set: None, path: str) -> None:
    with TestClient(app) as c:
        r = c.post(path, json={"query": "kosmos"}, headers={"x-internal-secret": "nope"})
    assert r.status_code == 401


@pytest.mark.parametrize("path", PAID)
@pytest.mark.parametrize("value", ["café", "", "   "])
def test_paid_tools_reject_odd_secret_values_with_401_not_500(
    secret_set: None, path: str, value: str
) -> None:
    with TestClient(app) as c:
        # Raw bytes, as a real client would send them (httpx won't encode non-ASCII str).
        r = c.post(path, json={"query": "kosmos"},
                   headers={"x-internal-secret": value.encode("latin-1")})
    assert r.status_code == 401


@pytest.mark.parametrize("path", PAID)
def test_paid_tools_accept_correct_secret(secret_set: None, path: str) -> None:
    with TestClient(app) as c:
        r = c.post(path, json={"query": "kosmos"}, headers={"x-internal-secret": SECRET})
    assert r.status_code == 200


def test_core_routes_unaffected_by_secret(secret_set: None) -> None:
    """A half-configured rollout must never break the claim flow."""
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        assert c.post("/tools/lookup_order", json={}).status_code == 400  # validation, not 401


def test_health_reports_feature_switches_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KNOWLEDGE_SOURCE", "vector")
    monkeypatch.setenv("AI_AGENTS_SECRET", SECRET)
    get_settings.cache_clear()
    with TestClient(app) as c:
        body = c.get("/health").json()
    assert body["knowledge_source"] == "vector"
    assert body["catalog_enabled"] is False
    assert body["internal_auth"] is True
    assert SECRET not in str(body)
