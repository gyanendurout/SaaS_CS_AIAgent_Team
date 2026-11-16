"""Deploy guard: every runtime dependency in pyproject.toml must be in uv.lock.

Vercel installs with ``uv sync --frozen`` — the lock file only. On 2026-11-16 a new
dependency (anthropic) was added to pyproject.toml without re-running ``uv lock``;
the deployed app crashed on import and every ai-agents route returned 500.
Fix: run ``uv lock`` after changing dependencies.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2]


def _norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def missing_from_lock(pyproject: str, lock: str) -> set[str]:
    deps = tomllib.loads(pyproject)["project"]["dependencies"]
    wanted = {_norm(re.split(r"[\s<>=!~;\[]", d, maxsplit=1)[0]) for d in deps}
    locked = {_norm(p["name"]) for p in tomllib.loads(lock).get("package", [])}
    return wanted - locked


def test_every_dependency_is_locked() -> None:
    pyproject = (APP_DIR / "pyproject.toml").read_text(encoding="utf-8")
    lock = (APP_DIR / "uv.lock").read_text(encoding="utf-8")
    missing = missing_from_lock(pyproject, lock)
    assert not missing, f"run `uv lock` in apps/ai-agents — not in uv.lock: {sorted(missing)}"


def test_guard_detects_an_unlocked_dependency() -> None:
    pyproject = '[project]\nname = "x"\ndependencies = ["openai>=1.0", "anthropic>=2.9.0"]\n'
    lock = 'version = 1\n[[package]]\nname = "openai"\nversion = "1.0"\n'
    assert missing_from_lock(pyproject, lock) == {"anthropic"}
