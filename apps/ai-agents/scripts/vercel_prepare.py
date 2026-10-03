"""Vercel build step — copy monorepo files the function needs into this app.

Vercel bundles only files under the project Root Directory (apps/ai-agents),
but this service depends on two things that live elsewhere in the monorepo:

  * packages/warranty-policy/warranty_policy  -> ./warranty_policy
    (the uv path source is installed editable, so site-packages only holds a
    .pth pointing back at the repo checkout, which is not shipped)
  * docs/policies/cs-knowledge-base-v1.md     -> ./_bundled/
    (read by app/prompts/system.py to build the response-agent prompt)

The project root is on sys.path at runtime, so the copied package is importable
as ``warranty_policy``. Both destinations are gitignored.

Runs via ``[tool.vercel.scripts] build`` in pyproject.toml.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parents[1]

POLICY_PKG_SRC = REPO_ROOT / "packages" / "warranty-policy" / "warranty_policy"
POLICY_PKG_DST = APP_ROOT / "warranty_policy"

KB_DOC_SRC = REPO_ROOT / "docs" / "policies" / "cs-knowledge-base-v1.md"
KB_DOC_DST = APP_ROOT / "_bundled" / KB_DOC_SRC.name


def _require(path: Path) -> None:
    if not path.exists():
        sys.exit(
            f"[vercel_prepare] missing {path} - enable 'Include files outside the "
            "root directory in the Build Step' in the Vercel project settings."
        )


def main() -> None:
    _require(POLICY_PKG_SRC)
    _require(KB_DOC_SRC)

    if POLICY_PKG_DST.exists():
        shutil.rmtree(POLICY_PKG_DST)
    shutil.copytree(
        POLICY_PKG_SRC,
        POLICY_PKG_DST,
        ignore=shutil.ignore_patterns("tests", "__pycache__", "*.pyc"),
    )

    KB_DOC_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(KB_DOC_SRC, KB_DOC_DST)

    print(f"[vercel_prepare] copied {POLICY_PKG_SRC} -> {POLICY_PKG_DST}")
    print(f"[vercel_prepare] copied {KB_DOC_SRC} -> {KB_DOC_DST}")


if __name__ == "__main__":
    main()
