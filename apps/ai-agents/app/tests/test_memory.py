"""Tests for the shared knowledge memory (app/memory) and its wiring.

All offline: no Supabase, no OpenAI. Vector mode is switched on per test via
the ``vector_mode`` fixture; the default must stay ``static``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.memory import service
from app.memory.chunker import chunk_markdown
from app.memory.ingest import ingest
from app.memory.store import SupabaseKnowledgeStore

# --------------------------------------------------------------------------- #
# Fixtures                                                                     #
# --------------------------------------------------------------------------- #


@pytest.fixture
def vector_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("KNOWLEDGE_SOURCE", "vector")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _fresh_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class FakeStore:
    """In-memory stand-in for SupabaseKnowledgeStore."""

    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.match_calls: list[tuple[list[float], int, float]] = []
        self.match_result: list[dict[str, Any]] = []

    def existing_hashes(self) -> set[str]:
        return set(self.rows)

    def upsert(self, rows: list[dict[str, Any]]) -> None:
        for r in rows:
            self.rows[r["content_hash"]] = r

    def delete_hashes(self, hashes: set[str]) -> None:
        for h in hashes:
            self.rows.pop(h, None)

    def match(self, embedding: list[float], k: int, min_score: float) -> list[dict[str, Any]]:
        self.match_calls.append((embedding, k, min_score))
        return self.match_result


def fake_embed(texts: list[str]) -> list[list[float]]:
    return [[float(len(t)), 0.0] for t in texts]


# --------------------------------------------------------------------------- #
# Config                                                                       #
# --------------------------------------------------------------------------- #


def test_knowledge_source_defaults_to_static() -> None:
    assert get_settings().knowledge_source == "static"


def test_knowledge_source_typo_falls_back_to_static(monkeypatch: pytest.MonkeyPatch) -> None:
    """A bad flag value must not take the whole service down."""
    monkeypatch.setenv("KNOWLEDGE_SOURCE", "chroma")
    assert Settings().knowledge_source == "static"  # type: ignore[call-arg]


def test_knowledge_source_is_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KNOWLEDGE_SOURCE", " Vector ")
    assert Settings().knowledge_source == "vector"  # type: ignore[call-arg]


# --------------------------------------------------------------------------- #
# Chunker                                                                      #
# --------------------------------------------------------------------------- #

DOC = """category: support

# Shipping

Intro line.

## Do you ship to Vietnam?

No, we do not ship to Vietnam.

## Empty heading

## What is the return policy?

See https://joola.com/pages/refunds-returns
"""


def test_chunker_keeps_each_question_with_its_answer() -> None:
    chunks = chunk_markdown(DOC, source="knowledge/x.md")
    vietnam = [c for c in chunks if c.heading == "Do you ship to Vietnam?"]
    assert len(vietnam) == 1
    assert "No, we do not ship to Vietnam." in vietnam[0].content
    assert vietnam[0].content.startswith("Do you ship to Vietnam?")


def test_chunker_drops_front_matter_and_empty_sections() -> None:
    chunks = chunk_markdown(DOC, source="knowledge/x.md")
    assert all("category:" not in c.content for c in chunks)
    assert [c.heading for c in chunks] == [
        "Shipping",
        "Do you ship to Vietnam?",
        "What is the return policy?",
    ]


def test_chunker_splits_long_sections_with_overlap() -> None:
    body = " ".join(f"word{i}" for i in range(300))  # ~2.3k chars
    chunks = chunk_markdown(f"## Long\n\n{body}\n", source="s.md", max_chars=500, overlap=75)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c.content) <= len("Long\n") + 500
    # Overlap: the tail of one piece reappears at the head of the next.
    first_tail = chunks[0].content[-75:]
    assert first_tail in chunks[1].content


def test_chunk_hash_is_stable_and_source_specific() -> None:
    a1 = chunk_markdown(DOC, source="a.md")
    a2 = chunk_markdown(DOC, source="a.md")
    b = chunk_markdown(DOC, source="b.md")
    assert [c.content_hash for c in a1] == [c.content_hash for c in a2]
    assert a1[0].content_hash != b[0].content_hash


# --------------------------------------------------------------------------- #
# Supabase store (thin glue — verify the calls it makes)                       #
# --------------------------------------------------------------------------- #


class _RecordingQuery:
    def __init__(self, log: list[tuple], data: list[dict[str, Any]] | None = None) -> None:
        self._log = log
        self._data = data or []

    def __getattr__(self, name: str):
        def _call(*args: Any, **kwargs: Any) -> _RecordingQuery:
            self._log.append((name, args, kwargs))
            return self

        return _call

    def execute(self) -> Any:
        return type("R", (), {"data": self._data})()


class _RecordingClient:
    def __init__(self, data: list[dict[str, Any]] | None = None) -> None:
        self.log: list[tuple] = []
        self._data = data

    def table(self, name: str) -> _RecordingQuery:
        self.log.append(("table", (name,), {}))
        return _RecordingQuery(self.log, self._data)

    def rpc(self, fn: str, params: dict[str, Any]) -> _RecordingQuery:
        self.log.append(("rpc", (fn, params), {}))
        return _RecordingQuery(self.log, self._data)


def test_store_match_calls_rpc_with_params() -> None:
    client = _RecordingClient(data=[{"source": "s", "heading": "h", "content": "c", "score": 0.9}])
    rows = SupabaseKnowledgeStore(client).match([0.1, 0.2], k=3, min_score=0.3)
    assert rows[0]["content"] == "c"
    assert ("rpc", ("match_kb_chunks", {"query_embedding": [0.1, 0.2], "match_count": 3, "min_score": 0.3}), {}) in client.log


def test_store_existing_hashes_pages_past_1000_rows() -> None:
    all_rows = [{"content_hash": f"h{i}"} for i in range(1005)]

    class _PagingQuery:
        def select(self, *_a: Any) -> _PagingQuery:
            return self

        def range(self, start: int, end: int) -> Any:
            page = all_rows[start : end + 1]
            return type("Q", (), {"execute": lambda _self: type("R", (), {"data": page})()})()

    class _PagingClient:
        def table(self, _name: str) -> _PagingQuery:
            return _PagingQuery()

    hashes = SupabaseKnowledgeStore(_PagingClient()).existing_hashes()  # type: ignore[arg-type]
    assert len(hashes) == 1005


def test_store_deletes_in_small_batches() -> None:
    """Hashes go in the URL query string, so deletes must be batched."""
    client = _RecordingClient()
    SupabaseKnowledgeStore(client).delete_hashes({f"h{i:03d}" for i in range(120)})
    batches = [args[1] for name, args, _ in client.log if name == "in_"]
    assert [len(b) for b in batches] == [50, 50, 20]


def test_embed_query_uses_short_timeout_without_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    class _Emb:
        def create(self, **kw: Any) -> Any:
            item = type("I", (), {"embedding": [0.5]})()
            return type("R", (), {"data": [item] * len(kw["input"])})()

    class _Client:
        embeddings = _Emb()

        def with_options(self, **kw: Any) -> _Client:
            seen.update(kw)
            return self

    monkeypatch.setattr(service, "get_openai", lambda: _Client())
    assert service.embed_query("returns") == [0.5]
    assert seen == {"timeout": service.QUERY_TIMEOUT_S, "max_retries": 0}


def test_store_upsert_targets_kb_chunks_on_hash() -> None:
    client = _RecordingClient()
    SupabaseKnowledgeStore(client).upsert([{"content_hash": "h1"}])
    assert ("table", ("kb_chunks",), {}) in client.log
    assert ("upsert", ([{"content_hash": "h1"}],), {"on_conflict": "content_hash"}) in client.log


# --------------------------------------------------------------------------- #
# Search service                                                               #
# --------------------------------------------------------------------------- #


async def test_search_is_disabled_in_static_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    store = FakeStore()
    monkeypatch.setattr(service, "get_store", lambda: store)
    monkeypatch.setattr(service, "embed_query", lambda q: [1.0])
    assert await service.search_knowledge("return policy") == []
    assert store.match_calls == []


async def test_search_returns_matches_in_vector_mode(
    vector_mode: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = FakeStore()
    store.match_result = [{"source": "s.md", "heading": "Returns", "content": "30 days", "score": 0.8}]
    monkeypatch.setattr(service, "get_store", lambda: store)
    monkeypatch.setattr(service, "embed_query", lambda q: [1.0, 2.0])
    hits = await service.search_knowledge("return policy", k=2)
    assert hits == store.match_result
    assert store.match_calls == [([1.0, 2.0], 2, service.MIN_SCORE)]


async def test_search_never_raises_when_backend_fails(
    vector_mode: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(_q: str) -> list[float]:
        raise RuntimeError("openai down")

    monkeypatch.setattr(service, "embed_query", boom)
    assert await service.search_knowledge("return policy") == []


async def test_search_gives_up_when_database_is_slow(
    vector_mode: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A hung Supabase call must not stall a reply: overall budget, then no memory."""
    import time

    class SlowStore(FakeStore):
        def match(self, embedding: list[float], k: int, min_score: float) -> list[dict[str, Any]]:
            time.sleep(1.0)
            return [{"source": "s", "heading": "h", "content": "c", "score": 0.9}]

    monkeypatch.setattr(service, "get_store", lambda: SlowStore())
    monkeypatch.setattr(service, "embed_query", lambda q: [1.0])
    monkeypatch.setattr(service, "SEARCH_BUDGET_S", 0.2)
    start = time.perf_counter()
    assert await service.search_knowledge("return policy") == []
    assert time.perf_counter() - start < 0.8


def test_search_uses_its_own_db_client_with_hard_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """The asyncio budget can't stop a worker thread; the HTTP timeout must."""
    seen: dict[str, Any] = {}

    def fake_create_client(url: str, key: str, options: Any = None) -> object:
        seen["timeout"] = getattr(options, "postgrest_client_timeout", None)
        return object()

    monkeypatch.setattr(service, "create_client", fake_create_client)
    service.get_memory_supabase.cache_clear()
    try:
        service.get_store()
        assert seen["timeout"] == service.DB_TIMEOUT_S
        assert service.DB_TIMEOUT_S < service.SEARCH_BUDGET_S
    finally:
        service.get_memory_supabase.cache_clear()


async def test_search_skips_blank_query(vector_mode: None, monkeypatch: pytest.MonkeyPatch) -> None:
    store = FakeStore()
    monkeypatch.setattr(service, "get_store", lambda: store)
    monkeypatch.setattr(service, "embed_query", lambda q: [1.0])
    assert await service.search_knowledge("   ") == []
    assert store.match_calls == []


# --------------------------------------------------------------------------- #
# Ingest                                                                       #
# --------------------------------------------------------------------------- #


def _write(root: Path, rel: str, text: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


def test_ingest_adds_then_is_idempotent(tmp_path: Path) -> None:
    f = _write(tmp_path, "knowledge/a.md", DOC)
    store = FakeStore()
    first = ingest([f], store=store, embed=fake_embed, model="m", root=tmp_path)
    assert first == {"added": 3, "removed": 0, "unchanged": 0}
    row = next(iter(store.rows.values()))
    assert row["source"] == "knowledge/a.md"
    assert row["embedding_model"] == "m"
    assert row["embedding"]

    second = ingest([f], store=store, embed=fake_embed, model="m", root=tmp_path)
    assert second == {"added": 0, "removed": 0, "unchanged": 3}


def test_default_sources_are_the_reviewed_knowledge_files() -> None:
    """Guards what callers can hear: only reviewed files are ingested."""
    from app.memory.ingest import REPO_ROOT, default_sources

    names = sorted(p.relative_to(REPO_ROOT).as_posix() for p in default_sources())
    assert names == [
        "docs/policies/cs-knowledge-base-v1.md",
        "knowledge/shopify/cs_product_guidance.md",
        "knowledge/shopify/cs_shipping_and_returns.md",
        "knowledge/shopify/paddle_registration.md",
        # Written only from policy §2.1–2.3, 2.5, 2.8, 4.5; owner-approved 2026-11-14.
        "knowledge/warranty/paddle_damage_and_defects.md",
    ]
    # Pending CS confirmation that it is real policy (trade-in credit, demo deposit).
    assert not any("internal_policies" in n for n in names)


def test_ingest_refuses_empty_sources_instead_of_wiping_table(tmp_path: Path) -> None:
    store = FakeStore()
    store.rows["keep"] = {"content_hash": "keep"}
    with pytest.raises(ValueError, match="no knowledge"):
        ingest([], store=store, embed=fake_embed, model="m", root=tmp_path)
    assert "keep" in store.rows


def test_ingest_embeds_and_upserts_in_batches(tmp_path: Path) -> None:
    doc = "\n".join(f"## Q{i}\n\nAnswer {i}.\n" for i in range(250))
    f = _write(tmp_path, "knowledge/big.md", doc)
    store = FakeStore()
    embed_sizes: list[int] = []

    def counting_embed(texts: list[str]) -> list[list[float]]:
        embed_sizes.append(len(texts))
        return fake_embed(texts)

    stats = ingest([f], store=store, embed=counting_embed, model="m", root=tmp_path)
    assert stats["added"] == 250
    assert embed_sizes == [100, 100, 50]
    assert len(store.rows) == 250


def test_ingest_replaces_edited_chunks(tmp_path: Path) -> None:
    f = _write(tmp_path, "knowledge/a.md", DOC)
    store = FakeStore()
    ingest([f], store=store, embed=fake_embed, model="m", root=tmp_path)

    f.write_text(DOC.replace("No, we do not ship", "Yes, we now ship"), encoding="utf-8")
    stats = ingest([f], store=store, embed=fake_embed, model="m", root=tmp_path)
    assert stats == {"added": 1, "removed": 1, "unchanged": 2}
    assert any("Yes, we now ship" in r["content"] for r in store.rows.values())
    assert not any("No, we do not ship" in r["content"] for r in store.rows.values())


# --------------------------------------------------------------------------- #
# /tools/search_knowledge (used by the voice agent via the API)                #
# --------------------------------------------------------------------------- #


def test_search_endpoint_reports_disabled_in_static_mode() -> None:
    with TestClient(app) as c:
        r = c.post("/tools/search_knowledge", json={"query": "return policy"})
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "results": []}


def test_search_endpoint_returns_results_in_vector_mode(
    vector_mode: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    hits = [{"source": "s.md", "heading": "Returns", "content": "30 days", "score": 0.8}]

    async def fake_search(query: str, k: int = 3) -> list[dict[str, Any]]:
        return hits

    import app.routes.tools as tools_mod

    monkeypatch.setattr(tools_mod, "search_knowledge", fake_search)
    with TestClient(app) as c:
        r = c.post("/tools/search_knowledge", json={"query": "return policy"})
    assert r.status_code == 200
    assert r.json() == {"enabled": True, "results": hits}


def test_search_endpoint_rejects_empty_query() -> None:
    with TestClient(app) as c:
        r = c.post("/tools/search_knowledge", json={"query": ""})
    assert r.status_code == 422


# --------------------------------------------------------------------------- #
# Response agent (email / web / post-call drafts)                              #
# --------------------------------------------------------------------------- #


async def _run_pipeline() -> None:
    from app.graph.build import get_compiled_graph

    await get_compiled_graph().ainvoke(
        {"claim_id": "WC-10001", "channel": "email", "raw_input": {"issue": "cracked paddle face"}}
    )


async def test_response_prompt_unchanged_in_static_mode(
    seeded_supabase: Any, fake_openai: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def must_not_search(*_a: Any, **_kw: Any) -> list[dict[str, Any]]:
        raise AssertionError("search must not run in static mode")

    import app.graph.nodes.response as response_mod

    monkeypatch.setattr(response_mod, "search_knowledge", must_not_search)
    await _run_pipeline()
    user_msg = fake_openai.chat.calls[-1]["messages"][1]["content"]
    assert "relevant_knowledge" not in user_msg


async def test_response_prompt_includes_knowledge_in_vector_mode(
    vector_mode: None, seeded_supabase: Any, fake_openai: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_search(query: str, k: int = 3) -> list[dict[str, Any]]:
        return [{"source": "s.md", "heading": "Paddle care", "content": "Clean with water.", "score": 0.7}]

    import app.graph.nodes.response as response_mod

    monkeypatch.setattr(response_mod, "search_knowledge", fake_search)
    await _run_pipeline()
    user_msg = fake_openai.chat.calls[-1]["messages"][1]["content"]
    assert "relevant_knowledge" in user_msg
    assert "Clean with water." in user_msg
    assert "policy wins" in user_msg
