"""Load knowledge markdown into the shared ``kb_chunks`` memory.

Incremental: only new/changed chunks are embedded; chunks whose text no longer
exists in the sources are deleted. Safe to re-run.

    cd apps/ai-agents && uv run python -m app.memory.ingest

Uses SUPABASE_URL / SUPABASE_SECRET_KEY / OPENAI_API_KEY from the repo-root
.env.local (or the process env). Run it after applying
migrations/memory/0001_kb_chunks.up.sql and whenever knowledge/*.md changes.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol

from app.memory.chunker import Chunk, chunk_markdown

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
BATCH = 100  # chunks per embedding request / upsert


class KnowledgeStore(Protocol):
    def existing_hashes(self) -> set[str]: ...
    def upsert(self, rows: list[dict[str, Any]]) -> None: ...
    def delete_hashes(self, hashes: set[str]) -> None: ...


def default_sources(root: Path = REPO_ROOT) -> list[Path]:
    """knowledge/**/*.md plus the master warranty policy doc."""
    files = sorted((root / "knowledge").rglob("*.md"))
    policy = root / "docs" / "policies" / "cs-knowledge-base-v1.md"
    return files + ([policy] if policy.is_file() else [])


def ingest(
    files: list[Path],
    *,
    store: KnowledgeStore,
    embed: Callable[[list[str]], list[list[float]]],
    model: str,
    root: Path = REPO_ROOT,
) -> dict[str, int]:
    current: dict[str, Chunk] = {}
    for path in files:
        source = path.resolve().relative_to(root.resolve()).as_posix()
        for chunk in chunk_markdown(path.read_text(encoding="utf-8"), source=source):
            current[chunk.content_hash] = chunk

    if not current:
        # Without this guard every existing row would count as stale and be deleted.
        raise ValueError("no knowledge chunks found in sources — refusing to sync (would wipe kb_chunks)")

    existing = store.existing_hashes()
    new = [c for h, c in current.items() if h not in existing]
    stale = existing - current.keys()

    for i in range(0, len(new), BATCH):
        batch = new[i : i + BATCH]
        vectors = embed([c.content for c in batch])
        store.upsert(
            [
                {
                    "source": c.source,
                    "heading": c.heading,
                    "content": c.content,
                    "content_hash": c.content_hash,
                    "embedding": v,
                    "embedding_model": model,
                }
                for c, v in zip(batch, vectors, strict=True)
            ]
        )
    store.delete_hashes(stale)

    return {"added": len(new), "removed": len(stale), "unchanged": len(current) - len(new)}


def main() -> None:
    from app.config import get_settings
    from app.memory.service import embed_texts, get_ingest_store

    logging.basicConfig(level="INFO", format="%(levelname)s %(message)s")
    files = default_sources()
    stats = ingest(
        files, store=get_ingest_store(), embed=embed_texts, model=get_settings().embedding_model
    )
    log.info("ingested %d files: %s", len(files), stats)


if __name__ == "__main__":
    main()
