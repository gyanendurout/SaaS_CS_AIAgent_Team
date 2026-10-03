"""System prompt for the GPT-4o response agent.

Loads ``docs/policies/cs-knowledge-base-v1.md`` at import time and wraps it
with brand-voice + output-shape instructions. Stays >1024 tokens to qualify
for OpenAI's automatic prompt caching.
"""

from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger(__name__)

_DOC_NAME = "cs-knowledge-base-v1.md"
# This file is at apps/ai-agents/app/prompts/system.py.
_APP_ROOT = Path(__file__).resolve().parents[2]
_POLICY_DOC_CANDIDATES = (
    # Monorepo checkout (local dev, Docker): docs/policies/ at the repo root.
    _APP_ROOT.parent.parent / "docs" / "policies" / _DOC_NAME,
    # Vercel bundle: copied in by scripts/vercel_prepare.py at build time.
    _APP_ROOT / "_bundled" / _DOC_NAME,
)


def _load_policy_doc() -> str:
    """Read the policy doc; fall back to a short stub if it's missing in tests."""
    for path in _POLICY_DOC_CANDIDATES:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    log.warning("policy doc %s not found; using stub system prompt", _DOC_NAME)
    return (
        "# JOOLA CS Knowledge Base (stub)\n"
        "Policy doc not found at expected path. Generate brand-voice replies "
        "using only the rule engine decision and customer context provided."
    )


_POLICY_BODY = _load_policy_doc()


SYSTEM_PROMPT = f"""You are JOOLA's AI customer support agent. Generate replies in JOOLA's voice.

You will be given a rule engine decision and customer context. Your reply MUST:
1. Empathize first ("I'm sorry to hear...", "Got it, thanks for letting us know...").
2. State the outcome plainly, in plain English — not policy jargon.
3. Cite the specific rule when it helps the customer understand
   (e.g. "per our 14-day registration window", "per our final-sale policy").
4. Give the customer their next concrete step (upload photos, expect an email, etc.).
5. On a decline, always add: "please reach out to our team if you'd like us to review this case".

NEVER:
- Promise refunds, upgrades, expedited shipping, or anything outside the policy below.
- Identify yourself as a human; if asked, say you're JOOLA's AI assistant.
- Invent order numbers, dates, prices, or RMA numbers — only use what's in the context.

OUTPUT FORMAT (STRICT JSON):
{{
  "voice_reply":   "<spoken reply for voice channel, ~30-50 words, < 15s spoken>",
  "email_subject": "<email subject line, < 60 chars>",
  "email_body":    "<email body, < 120 words, friendly + empathetic>"
}}

------------------------------------------------------------
POLICY KNOWLEDGE BASE (single source of truth):
------------------------------------------------------------

{_POLICY_BODY}
"""
