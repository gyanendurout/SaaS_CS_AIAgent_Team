"""Test fixtures.

Sets dummy env vars BEFORE importing anything from ``app`` so
``pydantic-settings`` validation passes during ``pytest`` collection.
Patches the Supabase + OpenAI singletons to in-memory fakes.
"""

from __future__ import annotations

import os
from collections import defaultdict
from typing import Any

import pytest

# Required env BEFORE the first `from app import ...` lands.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
os.environ.setdefault("OPENAI_MODEL", "gpt-4o")
os.environ.setdefault("POLICY_VERSION", "1.0.0")


# --------------------------------------------------------------------------- #
# Fake Supabase                                                                #
# --------------------------------------------------------------------------- #


class _FakeResult:
    def __init__(self, data: list[dict[str, Any]] | None = None) -> None:
        self.data = data or []


class _FakeQuery:
    def __init__(self, table: "_FakeTable", op: str, payload: Any = None) -> None:
        self._table = table
        self._op = op
        self._payload = payload
        self._filters: list[tuple[str, Any]] = []
        self._limit: int | None = None

    def select(self, *_a: Any, **_kw: Any) -> "_FakeQuery":
        return self

    def eq(self, col: str, val: Any) -> "_FakeQuery":
        self._filters.append((col, val))
        return self

    def order(self, *_a: Any, **_kw: Any) -> "_FakeQuery":
        return self

    def limit(self, n: int) -> "_FakeQuery":
        self._limit = n
        return self

    def execute(self) -> _FakeResult:
        rows = list(self._table.rows)
        for col, val in self._filters:
            rows = [r for r in rows if r.get(col) == val]
        if self._limit is not None:
            rows = rows[: self._limit]

        if self._op == "select":
            return _FakeResult(rows)

        if self._op == "insert":
            data = self._payload if isinstance(self._payload, list) else [self._payload]
            for row in data:
                row.setdefault("id", f"fake-{len(self._table.rows)+1}")
                self._table.rows.append(dict(row))
            return _FakeResult(data)

        if self._op == "update":
            for row in rows:
                row.update(self._payload)
            return _FakeResult(rows)

        if self._op == "upsert":
            data = self._payload if isinstance(self._payload, list) else [self._payload]
            for row in data:
                key = row.get("id")
                existing = next((r for r in self._table.rows if r.get("id") == key), None)
                if existing:
                    existing.update(row)
                else:
                    self._table.rows.append(dict(row))
            return _FakeResult(data)

        return _FakeResult()


class _FakeTable:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def select(self, *_a: Any, **_kw: Any) -> _FakeQuery:
        return _FakeQuery(self, "select")

    def insert(self, payload: Any) -> _FakeQuery:
        return _FakeQuery(self, "insert", payload)

    def update(self, payload: Any) -> _FakeQuery:
        return _FakeQuery(self, "update", payload)

    def upsert(self, payload: Any) -> _FakeQuery:
        return _FakeQuery(self, "upsert", payload)


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, _FakeTable] = defaultdict(_FakeTable)

    def table(self, name: str) -> _FakeTable:
        return self.tables[name]


# --------------------------------------------------------------------------- #
# Fake OpenAI                                                                  #
# --------------------------------------------------------------------------- #


class _FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeChoice:
    def __init__(self, content: str) -> None:
        self.message = _FakeMessage(content)


class _FakeChat:
    def __init__(self) -> None:
        self.completions = self

    def create(self, **_kw: Any) -> Any:
        payload = (
            '{"voice_reply":"Got it — we will check and follow up.",'
            '"email_subject":"Re: Your JOOLA claim",'
            '"email_body":"Hi, thanks for reaching out. We received your claim and are reviewing it."}'
        )
        return type("Resp", (), {"choices": [_FakeChoice(payload)]})()


class FakeOpenAI:
    def __init__(self) -> None:
        self.chat = _FakeChat()


# --------------------------------------------------------------------------- #
# Fixtures                                                                     #
# --------------------------------------------------------------------------- #


@pytest.fixture
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> FakeSupabase:
    fake = FakeSupabase()
    # Patch every importer.
    import app.services.supabase_client as sb_mod
    import app.services.audit as audit_mod
    import app.services.agent_state as agent_state_mod
    import app.graph.nodes.shopify as shopify_mod
    import app.graph.nodes.warrreg as warrreg_mod
    import app.graph.nodes.rules as rules_mod
    import app.graph.nodes.summary as summary_mod
    import app.graph.nodes.response as response_mod
    import app.graph.nodes.escalation as escalation_mod
    import app.routes.tools as tools_mod

    sb_mod.get_supabase.cache_clear()  # type: ignore[attr-defined]
    for mod in (
        sb_mod,
        audit_mod,
        agent_state_mod,
        shopify_mod,
        warrreg_mod,
        rules_mod,
        summary_mod,
        response_mod,
        escalation_mod,
        tools_mod,
    ):
        monkeypatch.setattr(mod, "get_supabase", lambda fake=fake: fake)
    return fake


@pytest.fixture
def fake_openai(monkeypatch: pytest.MonkeyPatch) -> FakeOpenAI:
    fake = FakeOpenAI()
    import app.services.openai_client as oa_mod
    import app.graph.nodes.response as response_mod

    oa_mod.get_openai.cache_clear()  # type: ignore[attr-defined]
    for mod in (oa_mod, response_mod):
        monkeypatch.setattr(mod, "get_openai", lambda fake=fake: fake)
    return fake


@pytest.fixture
def seeded_supabase(fake_supabase: FakeSupabase) -> FakeSupabase:
    """Seed a customer + order + registration + claim for end-to-end tests."""
    fake_supabase.tables["customers"].rows.append(
        {
            "id": "cust-1",
            "name": "Alex Demo",
            "email": "alex@example.com",
            "country": "US",
            "phone": "+15551234567",
        }
    )
    fake_supabase.tables["orders"].rows.append(
        {
            "id": "order-1",
            "order_number": "J-12345",
            "customer_id": "cust-1",
            "product_name": "Perseus NFC",
            "product_sku": "PAD-NFC-001",
            "product_type": "PADDLE_NFC",
            "purchase_date": "2026-05-01",
            "source": "JOOLA_DIRECT",
            "authorized": True,
        }
    )
    fake_supabase.tables["registrations"].rows.append(
        {
            "id": "reg-1",
            "order_id": "order-1",
            "registered": True,
            "nfc_id": "NFC-1",
            "registered_at": "2026-05-03T00:00:00+00:00",
            "within_window": True,
            "receipt_uploaded": True,
            "receipt_approved": True,
        }
    )
    fake_supabase.tables["claims"].rows.append(
        {
            "id": "WC-10001",
            "customer_id": "cust-1",
            "order_id": "order-1",
            "channel": "voice",
            "issue": "My paddle face is cracked after a few weeks.",
            "status_detail": "NEW",
            "decision": "PROCESSING",
            "policy_version": "1.0.0",
            "stage": "intake",
        }
    )
    return fake_supabase
