# QA Report — CS Shared Memory + Live Shopify Catalogue

**Branch:** `feat/cs-memory` · **Date:** 2026-11-14 · **Scope:** knowledge memory (`search_knowledge`, response-agent snippets), live catalogue (`search_products`), Vapi tool path, shared-secret auth, `/health` switches.
**Runbook:** [../CS_MEMORY_RUNBOOK.md](../CS_MEMORY_RUNBOOK.md)

## Verdict

**Ready to deploy**, pending the manual checks in "Not covered" below. Eight defects/risks found and fixed (plus one improvement), each with a regression test or a before/after measurement; three independent code reviews; no open CRITICAL/HIGH issues.

## Environment

Local servers (ai-agents :8000, API :3001, dashboard :3000, customer demo :3003), ngrok tunnel to the API, **production** Supabase `isrcdvhtfnbzlnvhgule` (read-only during QA — no claims, drafts or rows written) and the live JOOLA Shopify store (read-only Storefront API).

## Results

| Area | Method | Result |
|---|---|---|
| Unit tests (ai-agents) | pytest, offline fakes | **89 passed** |
| Rules engine regression | `packages/warranty-policy` pytest | **90 passed** (unchanged) |
| Coverage, whole `app` package | pytest-cov | **93 %**; new modules 82–100 % |
| Typecheck | `tsc --noEmit` api, dashboard, customer-demo, vapi-setup | all clean |
| Vercel build simulation | `pnpm build` (api), `vercel_prepare.py` + import (ai-agents) | OK, both tool routes present, build output not tracked |
| Retrieval quality (live) | every knowledge heading (192) asked as a question | **192/192 in top-3**, 189 top-1 |
| Retrieval, customer wording | 20 paraphrases with expected answers | **20/20** |
| Retrieval, off-topic | weather / sport / joke | **no match** (correct) |
| Catalogue, voice phrasing (live) | 16 spoken-style questions | all correct after fixes (see BUG-1..3) |
| Adversarial input | 15 cases × 2 tools × 2 services (unicode, zero-width, RTL, Shopify-syntax / SQL / prompt injection, wrong types, non-JSON, 1000 chars) | **60/60**: 400/422 for bad input, never 5xx, response shape always valid |
| Vapi path | signed `tool-calls` webhook (parallel calls, both arg formats, unknown tool) — local and via ngrok | both tools answer; unknown tool handled; **forged signature → 401** |
| Failure: ai-agents hanging | 2nd API pointed at a server that never responds | degrades to `enabled:false` in **5.3 s** |
| Failure: ai-agents down | connection refused | degrades in **0.28 s** |
| Load: catalogue | 20 / 50 concurrent via API | **0.57 s / 1.0 s** wall, all succeeded (after BUG-4 fix) |
| Load: knowledge | 20 concurrent via API | 2.1 s wall, all succeeded |
| Latency | sequential via API | knowledge p50 0.9 s; catalogue p50 0.32 s (0.02 s cached) |
| Auth | direct call without / with wrong secret | **401**; via API works; claim routes unaffected |

## Defects found and fixed

| ID | Severity | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| BUG-1 | High | "JOOLA iPong V300" → no match | 154/512 (30 %) titles lack "JOOLA"; every keyword must match | brand word treated as filler | `test_keywords_drop_brand_word_*` |
| BUG-2 | High | "Perseus 16 mm / sixteen millimeter" → no match | titles always write `16mm` as one token | normalise spoken thickness | `test_keywords_join_spoken_thickness_*` |
| BUG-3 | Medium | "Kosmos pro vee" → no match | speech-to-text spells V as "vee" | map after "pro" | `test_keywords_map_spoken_letter_vee_*` |
| BUG-4 | High | 20 concurrent lookups took ~4 s; 50 → some timed out | a new HTTP client per lookup = 168 ms blocking SSL-context build each | one pooled client per process | `test_client_reuses_one_connection_pool_*`, `test_service_reuses_the_same_client` |
| RISK-1 | Medium | a hung database could stall email/web drafts | Supabase RPC had no timeout | 4 s overall budget, reply continues without memory | `test_search_gives_up_when_database_is_slow` |
| IMP-1 | — | "Collin Johns Scorpeus 3" (doesn't exist) → nothing | no closest-match fallback | retry once without the last word; results flagged `closest_match: true` so the assistant never quotes them as the exact model | `test_client_relaxes_to_closest_match_*`, `test_one_deadline_covers_the_closest_match_retry` |
| BUG-5 | Medium (local only) | every local tool call +2.2 s (Vapi round-trip 3.3 s) | `PYTHON_AI_URL=localhost` → Windows tries IPv6 ::1 first, ai-agents listens on IPv4 | local env + templates use `127.0.0.1`; runbook updated | measured: 3.3 s → 0.8–1.5 s |
| SEC-1 | Medium | non-ASCII `X-Internal-Secret` → 500 instead of 401 | `hmac.compare_digest(str, str)` raises on non-ASCII | compare UTF-8 bytes | `test_paid_tools_reject_odd_secret_values_*` (verified to fail on old code) |
| RISK-2 | Medium | a hung DB could pile up worker threads shared with the claim pipeline | asyncio budget stops waiting, not the thread | dedicated Supabase client for searches with a 3 s HTTP timeout (ingest keeps the default) | `test_search_uses_its_own_db_client_with_hard_timeout` |

Earlier review rounds (before this QA pass) fixed: possessive apostrophes, retry budget, cheapest-available headline price, relevance sort, bounded cache, empty-source ingest guard, batched deletes, lenient switches, 3 s embedding timeout.

## Production-readiness changes made

- `AI_AGENTS_SECRET` shared secret on the two paid endpoints (rollout order in the runbook; half-configured = tools degrade, core flow unaffected).
- `/health` reports `knowledge_source`, `catalog_enabled`, `internal_auth` for post-deploy checks.
- Env templates updated; `graphify-out/`, `.coverage` and the `Shopify-Chatbot/` reference checkout git-ignored.
- Vapi `search_products` description: present closest matches as such (needs re-push, see below).
- Test that only reviewed knowledge files are ingested (trade-in file stays excluded).

## Not covered / manual before go-live

1. **A real phone/browser call** on the deployed stack (simulated Vapi calls passed).
2. **Vercel**: env vars + redeploy, then `GET <ai-agents>/health` and the curl checks in runbook §6.
3. **Vapi**: re-push the updated `search_products` description (`pnpm vapi:add-tool:apply -- search_products`) and point the webhook at Vercel.
4. Email/web-form drafts with memory on were verified by unit tests only — a live submission writes to **production**, so it was not run.

## Residual risks / known limitations

- No dev/staging Supabase: local testing writes to production.
- Older ai-agents endpoints (pipeline, claims) remain unauthenticated (pre-existing).
- Catalogue can't browse ("what's on sale?"); order status still uses seeded data.
- Some knowledge answers contain past dates ("late 2024") — CS content review needed.
- Local: uvicorn `--reload` on Windows can miss changes — restart after pulling (hit during QA).
- Tooling: `--cov=app.routes.health` (single submodule) crashes pytest collection (pydantic/coverage interaction); use `--cov=app`.
- Connection pooling assumes one event loop per process (true for uvicorn). Confirm on Vercel after deploy: 20 concurrent `search_products` should finish in well under 2 s.
- `/health` reveals whether `internal_auth` is on (boolean only) — acceptable for ops checks.
- Closest-match drops the *last* word; the `closest_match` flag + tool description make the assistant confirm before quoting.
