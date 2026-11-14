# Project Status & Handoff — JOOLA CS AI Agent Team

**Last updated:** 2026-11-14 (night) · **Owner:** grout@joola.com · **Branch:** `main` (= `feat/cs-memory`, pushed 2026-11-14)

Read this first when you come back to the project or switch accounts. It records
what exists, what is live, what is pending, and every decision made so far.
**No secrets are stored here** — only variable names and where values live.

| Need | Go to |
|---|---|
| How to run locally / deploy to Vercel / troubleshoot | [CS_MEMORY_RUNBOOK.md](CS_MEMORY_RUNBOOK.md) |
| Test evidence and bugs fixed | [qa/2026-11-14-cs-memory-catalog-qa.md](qa/2026-11-14-cs-memory-catalog-qa.md) |
| Design decisions (memory) | [plans/2026-11-14-cs-memory.md](plans/2026-11-14-cs-memory.md) |
| Design decisions (catalogue) | [plans/2026-11-14-shopify-catalog.md](plans/2026-11-14-shopify-catalog.md) |

---

## 1. Goal

Centralise the CS agents' knowledge and live store data so **every channel —
voice calls (Vapi), email, web/contact form, post-call drafts, and later the
Shopify storefront chatbot — uses the same memory and connectors**.
Phase 1 (done): bring over what the separate Shopify chatbot had (knowledge
memory + Shopify Storefront). Later phases: real orders (Shopify Admin), NetSuite,
the "Infinity" connector, gap logging.

## 2. Systems and environments

| System | Fact |
|---|---|
| Repo | GitHub `gyanendurout/SaaS_CS_AIAgent_Team`, pnpm + Turbo monorepo |
| Apps | `apps/api` (Fastify, Vercel) · `apps/ai-agents` (FastAPI + LangGraph, Vercel) · `apps/dashboard` (Next.js, :3000) · `apps/customer-demo` (Next.js, :3003) · `apps/vapi-setup` (Vapi admin scripts) |
| Database | **Supabase `isrcdvhtfnbzlnvhgule` = PRODUCTION** (the only project; local dev also uses it) |
| Vector memory | table `public.kb_chunks` + RPC `match_kb_chunks` in that project — **applied 2026-11-14, 214 chunks loaded** |
| Voice | Vapi assistant **"JOOLA CS Warranty Assistant"**, id `397c019b-f428-4709-9473-2c102009a654`, **7 tools** (5 original + `search_knowledge` + `search_products`) |
| Vapi webhook | **`https://joola-cs-api.vercel.app/webhooks/vapi`** (Vercel production) |
| Shopify | **Team JOOLA sandbox store only** (`b0e265-3` / `joola1.myshopify.com`, primary domain `sandbox.joola.com`, Shopify Plus, USD, orders `#1001…`) — used by Vercel/Vapi production **on purpose** (owner decision 2026-11-14). Storefront API token reused from the Shopify chatbot, API version `2026-07`. Celigo syncs its orders to NetSuite. Live stores (JOOLA-USA etc., 18 in the org) are **out of scope** |
| AI models | OpenAI GPT-4o (replies), `text-embedding-3-small` (memory) |
| Shopify chatbot (reference only) | separate Bitbucket repo `joola-qb/joola-shopify-chat-bot`; a copy may sit in `Shopify-Chatbot/` here — **git-ignored, never commit** (its `.env` has real secrets) |

## 3. What has been built (branch `feat/cs-memory`)

| Commit | Content |
|---|---|
| `49d4411` | Shared knowledge memory (pgvector), live Shopify catalogue, `search_knowledge` + `search_products` voice tools, `vapi:add-tool` script, runbook |
| `f61e83e` | QA pass: voice-phrasing fixes, connection pooling, timeouts, `AI_AGENTS_SECRET`, `/health` switches, QA report |
| `57d5f8f`…`020268e` | docs: handoff, go-live state, Vercel preview env fix, Vapi webhook → Vercel (all pushed, `main` = `020268e`) |
| `2d85522` + `045f9fb` | fix: JOOLA pronounced "YOO-la" on calls (Vapi part live) + misheard-brand mapping in searches — pushed to `main`, ai-agents + api redeployed READY |
| `b0ed7cd` + QA fixes | feat: live Shopify order cards on the demo call page (`ORDER_SAMPLE_EMAIL_DOMAINS`), full QA pass ([report](qa/2026-11-14-full-qa.md)): **critical** fix — `/api/tools/*` only via signed Vapi webhook + strict order-number/email input rules; catalogue decimals + product links; postcode-only brake; 8 s live-tool timeout. pushed + deployed 2026-11-14; prod `/api/tools/*` direct → 403. Follow-up: warranty Rule 17b (late NFC = 6 months, §4.5), defect knowledge (+11 chunks), demo emails `*` on Vercel |
| `5590e9a` | feat: `get_order_status` — live Shopify Admin order status (Team JOOLA sandbox), caller check by email or postcode, failed-check brake, no personal data returned; behind `ORDER_SOURCE` (on in Vercel since 2026-11-14) |

**Behaviour switches (all default OFF = original behaviour):**

| Switch | Values | Effect |
|---|---|---|
| `KNOWLEDGE_SOURCE` | `static` / `vector` | memory search for voice tool + email/web/post-call drafts |
| `CATALOG_SOURCE` | `off` / `shopify` | live price / sale / stock voice tool |
| `ORDER_SOURCE` | `off` / `shopify` | live order status voice tool (`get_order_status`); needs `SHOPIFY_ADMIN_CLIENT_ID` + `SHOPIFY_ADMIN_CLIENT_SECRET` |
| `AI_AGENTS_SECRET` | unset / shared value | protects the paid/live tool endpoints |

**Quality at last check (2026-11-14):** ai-agents 89 tests pass (93 % coverage),
warranty-policy 90 pass, TypeScript clean in all apps, API build OK; retrieval
192/192 + 20/20 paraphrases; full voice tool round-trip 0.8–1.5 s.

## 4. Current state — what is LIVE vs NOT

| Item | State |
|---|---|
| `kb_chunks` table + 214 chunks in production Supabase | ✅ live (additive, nothing existing changed) |
| Vapi assistant has `search_knowledge` + `search_products` | ✅ live (same assistant id; backups in `apps/vapi-setup/backups/`, git-ignored) |
| Vapi `search_products` **updated description** (closest-match wording) | ✅ pushed 2026-11-14 (backup `backups/2026-11-14T20-38-49-147Z-model.json`) |
| Code on GitHub | ✅ pushed; `main` fast-forwarded to `57d5f8f` |
| Vercel (API + ai-agents) | ✅ deployed `57d5f8f` with `KNOWLEDGE_SOURCE=vector`, `CATALOG_SOURCE=shopify`, Shopify vars, new prod `AI_AGENTS_SECRET` (both projects, production+preview). `/health` OK; memory + catalogue answer via `https://joola-cs-api.vercel.app/api/tools/*`; direct ai-agents call without secret → 401; 20 concurrent lookups 0.35–0.55 s warm (first burst after a deploy can degrade to `enabled:false` on cold start) |
| Vercel (dashboard + customer-demo) | code unchanged by this work; Vercel's Ignored Build Step (turbo-ignore) cancels their builds when their folders don't change — that is expected, not a failure. Fixed 2026-11-14: dashboard **preview** builds failed because `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` was Production-only — now Production + Preview |
| Vapi webhook → Vercel | ✅ `https://joola-cs-api.vercel.app/webhooks/vapi` since 2026-11-14 (previous: `https://uncoated-oxymoron-written.ngrok-free.dev/webhooks/vapi` — switch back with the same command for local testing) |
| Brand pronunciation (JOOLA = "YOO-la", was heard as "Julia") | Vapi part ✅ live 2026-11-14: voice text-replacement JOOLA→"Yoola" (speech only), Deepgram `keyterm: JOOLA`, `## BRAND NAME` note in the live prompt (`pnpm vapi:fix-brand-voice[:apply]`, backup `backups/2026-11-14T20-53-14-905Z-brand-voice.json`). Search part (`app/brand.py`: Julia/Jula/Yola/Yoola/Jolla → JOOLA in memory + catalogue queries) is live once pushed to `main` |
| Live order status (`get_order_status`) | code done (132 tests); **verified against Team JOOLA 2026-11-14**: app `JOOLA CS Agent` installed, scopes `read_orders,read_all_orders,read_customers,read_fulfillments,read_returns` granted, 4 301 orders visible back to #1001 (2024), email + postcode readable, right email → `ok` (~0.2 s), wrong email / missing → `not_found`, tracking (99 Minutos) mapped. Credentials in local `.env.local` only. **Production 2026-11-14:** pushed (`main` = `5175dcd`), Vercel ai-agents has `ORDER_SOURCE=shopify` + `SHOPIFY_ADMIN_CLIENT_ID` + `SHOPIFY_ADMIN_CLIENT_SECRET` (sensitive; production+preview), redeployed READY; live `POST https://joola-cs-api.vercel.app/api/tools/get_order_status` → right email `ok`, wrong email `not_found`. **Vapi tool added 2026-11-14** (8 tools, same id; backup `backups/2026-11-14T23-36-28-492Z-model.json`). Test by voice next. Owner to rotate the client secret (it was pasted in chat) |
| Local `.env.local` | memory ON, catalogue ON, local `AI_AGENTS_SECRET` set, `PYTHON_AI_URL=http://127.0.0.1:8000` |

## 5. Go-live checklist (in order)

> **Status 2026-11-14:** steps 1–7 and 9 DONE. **Remaining:** step 8 — one real test call on the customer demo.
> (For reference, steps 6–7 were run as:)
> `cd apps/vapi-setup && PUBLIC_BACKEND_URL=https://joola-cs-api.vercel.app/webhooks/vapi pnpm vapi:update-webhook:apply`
> then `pnpm vapi:add-tool:apply -- search_products`, then step 8 (real test call).
> The URL **must include `/webhooks/vapi`** (script uses it verbatim). The production
> `AI_AGENTS_SECRET` exists only in Vercel (API + ai-agents, type sensitive) — to rotate,
> generate a new one and set it on both projects, then redeploy both.
> Vercel projects: `joola-cs-api`, `joola-cs-ai-agents`, `joola-cs-dashboard`, `joola-cs-customer-demo`
> (team of Vercel user `grout-9590`, all auto-deploy from GitHub `main`).

1. `git push -u origin feat/cs-memory` → PR / merge to `main`.
2. Generate a **new** production secret (do not reuse the local one):
   `python -c "import secrets; print(secrets.token_urlsafe(32))"`
3. Vercel **API** project: `AI_AGENTS_SECRET` → redeploy. *(API first.)*
4. Vercel **ai-agents** project: `KNOWLEDGE_SOURCE=vector`, `CATALOG_SOURCE=shopify`,
   `SHOPIFY_STORE`, `SHOPIFY_STOREFRONT_TOKEN`, same `AI_AGENTS_SECRET` → redeploy.
5. Verify: `GET <ai-agents>/health` → `knowledge_source: vector`, `catalog_enabled: true`,
   `internal_auth: true`; then the curl checks in runbook §6.
6. Re-push the tool description: `cd apps/vapi-setup && pnpm vapi:add-tool:apply -- search_products`.
7. Point Vapi at Vercel: set `PUBLIC_BACKEND_URL=https://<api>.vercel.app` in `.env.local`,
   then `pnpm vapi:update-webhook` (dry run) → `pnpm vapi:update-webhook:apply`.
8. One real test call on the deployed demo ("Do you ship to Vietnam?", "Is the Kosmos Pro V in stock?").
9. Confirm on Vercel: 20 concurrent `search_products` well under 2 s (pooling check).

**Rollback:** switches back to `static`/`off` + redeploy; Vapi tool removal via backup
(`PATCH { model: <backup> }`); DB objects via `migrations/memory/0001_kb_chunks.down.sql`.

## 6. Open decisions / waiting on people

| # | Question | Who |
|---|---|---|
| D1 | Is `joola_internal_policies.md` (25 % trade-in credit, $50 demo deposit) real policy? Excluded until confirmed (a test enforces it). | CS lead |
| D2 | "Infinity" connector: the **JOOLA Infinity app** (paddle registration / subscription, per the voice prompt) or a warehouse/3PL? | Owner |
| D3 | CS review of outdated answers in `knowledge/shopify/cs_product_guidance.md` ("late 2024", "end of 2024"); re-run ingest after edits | CS team |
| D4 | Should a separate dev/staging Supabase exist? Today local testing writes to production. | Owner / DevOps |

## 7. Security follow-ups

- Rotate the **Shopify Storefront token** (it is in the chatbot's Bitbucket history) — update chatbot, `.env.local`, Vercel.
- Clean the saved "allow" rules in `.claude/settings.json` / `.claude/settings.local.json` (≈42 embedded keys; git-ignored but plain text on disk) and rotate those keys.
- Older ai-agents endpoints (pipeline, claims) are still unauthenticated (pre-existing) — keep the ai-agents URL private; consider extending `AI_AGENTS_SECRET`.

## 8. Roadmap (next features) and what each needs

| # | Feature | Value | Needs |
|---|---|---|---|
| 1 | **Gap logging** (questions memory couldn't answer, all channels) | CS sees missing knowledge | nothing new (Supabase) |
| 3 | **Real Shopify orders** instead of seeded `orders`/`customers` in `lookup_order`, eligibility, pipeline | biggest upgrade | Dedicated Dev Dashboard app **`JOOLA CS Agent`** (org `101837077`, app `447539445761`, version `v2-read-only-orders`), installed on Team JOOLA only, 2026-11-14 — reusing `joola-ai-chatbot` was dropped (not installed on Team JOOLA). Do **not** reuse Celigo/Migration/Sync tokens (write scopes). Scopes `read_orders`, `read_all_orders`, `read_customers`, `read_fulfillments`, `read_returns`, `read_products` + protected customer data; client-credentials token (24 h, auto-refresh); `ORDER_SOURCE` default-off switch |
| 4 | joola.com policy pages as knowledge | official pages in memory | URL list + CS sign-off |
| 5 | Trade-in / internal policies knowledge | more answers | D1 |
| 6 | Answer cache | lower OpenAI cost | nothing new |
| 7 | Storefront chat history for callers | context across channels | chatbot RDS access + chatbot team OK |
| 8 | Paddle Finder on calls | pre-sales | Paddle Selector service URL/auth (likely AWS-internal) |
| 9 | Re-point the storefront chatbot to this system | true single memory | chatbot + Remix repo changes |
| — | NetSuite (all-channel orders), Infinity connector | — | credentials; D2 |
| — | Email/web drafts using live stock; "what's on sale" browsing | — | nothing new |

## 9. Decision log (summary)

| Decision | Why |
|---|---|
| Memory in **pgvector inside this project's Supabase** (not chatbot RDS/Chroma, not Google Vertex) | reachable from Vercel, no new infra, vectors survive deploys; the natt RDS is a different project and must not be touched |
| **OpenAI embeddings** (not bge) | runs on Vercel serverless (no torch) |
| supabase-py `rpc()` (no new DB driver) | zero new dependencies, HTTPS works on Vercel |
| Catalogue via **Shopify title search (all words required)** instead of downloading the whole catalogue | probe: free-text search ranked badly; full catalogue = ~2 s per Vercel cold start; title search 0.3–0.6 s and precise |
| Reuse the chatbot's Storefront token | owner decision; read-only token |
| Everything behind **default-off switches**; new code in new modules | owner requirement: must be able to go back to previous behaviour |
| `vapi:add-tool` (PATCH in place) — **never `vapi:recreate:apply`** | recreate deletes the assistant and changes its id, breaking every configured app |
| `AI_AGENTS_SECRET` only on the two paid endpoints | half-configured rollout can only switch off the voice tools, never the claim flow |
| Read-only connectors in phase 1 | no risk of corrupting Shopify/ERP data |
| **Shopify = Team JOOLA sandbox only**, even for Vercel/Vapi production | owner decision 2026-11-14: no production Shopify store is touched; switching later is an env change |

## 10. Resuming work (any machine / account)

1. Clone/pull, `git checkout feat/cs-memory` (or `main` after merge).
2. Recreate `.env.local` from `.env.example` (values from the team's secret store / Vercel / Supabase / Shopify / Vapi dashboards) — never from git.
3. Start servers as in runbook §5.1 (ai-agents on `127.0.0.1:8000`, API `:3001`).
4. Tests: `cd apps/ai-agents && .venv/Scripts/python -m pytest -q` (offline, no keys needed).
5. Check this file's §4–§6 for what is pending, then continue with §5 or §8.
6. When you finish a work session, update §3, §4 and "Last updated" above.
