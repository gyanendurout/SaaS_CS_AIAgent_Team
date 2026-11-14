# CS Shared Memory — Runbook (local vs cloud)

How to run, test, update and roll back the shared knowledge memory that the
voice agent, email, web form and post-call drafts use.

Design and decisions: [plans/2026-11-14-cs-memory.md](plans/2026-11-14-cs-memory.md).

---

## 1. What it is

Customer-service knowledge (product fit, lenses, shipping destinations, returns,
paddle registration, the warranty policy) is split into chunks, embedded with
OpenAI and stored in **Supabase pgvector** (table `kb_chunks`). Every channel
searches that one table.

```text
Voice call ─ Vapi ─▶ API /webhooks/vapi ─▶ API /api/tools/search_knowledge ─┐
Email / web form / post-call ─▶ ai-agents pipeline (response agent) ────────┤
                                                                            ▼
                                     ai-agents  search_knowledge()  ─▶  Supabase kb_chunks
                                     (OpenAI embedding of the question)    (match_kb_chunks)
```

- **Off by default.** `KNOWLEDGE_SOURCE=static` (or unset) = original behaviour, no search.
  `KNOWLEDGE_SOURCE=vector` = memory on. A typo falls back to `static`.
- **Never breaks a reply or call.** If Supabase/OpenAI fail or take >3 s, the reply
  is drafted without memory; the voice tool returns `enabled:false` and the
  assistant uses its built-in knowledge. The policy doc always wins over a snippet.
- **One memory for local and cloud.** Local servers and Vercel both read the same
  Supabase project, so knowledge loaded once is visible everywhere.

> **⚠️ The Supabase project `isrcdvhtfnbzlnvhgule` is PRODUCTION.** Every `.env.local`
> points at it, so **local servers read and write production data**: a test email /
> web form / call on a laptop creates real claims, drafts and case events. Use clearly
> fake test data, and run migrations / ingest only with approval.

## 2. Where things live

| What | Path |
|---|---|
| Knowledge source files | `knowledge/shopify/*.md` + `docs/policies/cs-knowledge-base-v1.md` |
| Database schema (manual) | `migrations/memory/0001_kb_chunks.up.sql` / `.down.sql` |
| Memory code | `apps/ai-agents/app/memory/` (chunker, store, service, ingest) |
| Response-agent hook | `apps/ai-agents/app/graph/nodes/response.py` |
| ai-agents endpoint | `POST /tools/search_knowledge` (`apps/ai-agents/app/routes/tools.py`) |
| Voice tool route | `POST /api/tools/search_knowledge` (`apps/api/src/routes/tools/search-knowledge.ts`) |
| Vapi tool schema | `packages/vapi-assistant-config/tools/search_knowledge.json` |
| Add a tool to the live assistant | `apps/vapi-setup` → `pnpm vapi:add-tool` |
| Tests | `apps/ai-agents/app/tests/test_memory.py` |

## 3. Environment variables

| Variable | Where | Value |
|---|---|---|
| `KNOWLEDGE_SOURCE` | ai-agents (`.env.local` locally, Vercel ai-agents project in cloud) | `static` (off) or `vector` (on) |
| `CATALOG_SOURCE` + `SHOPIFY_*` | ai-agents | live product catalogue, see section 10 |
| `EMBEDDING_MODEL` | ai-agents | optional, default `text-embedding-3-small` (must stay 1536-dim) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY` | ai-agents | already required by the app |
| `PYTHON_AI_URL` | API | URL of ai-agents (`http://localhost:8000` locally) |
| `PUBLIC_BACKEND_URL` | repo-root `.env.local`, used by `apps/vapi-setup` | public API URL Vapi should call (ngrok locally, Vercel API in cloud) |

Never commit `.env.local`. Only `.env.example` files are tracked.

---

## 4. One-time setup (already done on production `isrcdvhtfnbzlnvhgule`, 2026-11-14: 214 chunks)

1. Supabase dashboard → SQL Editor → run `migrations/memory/0001_kb_chunks.up.sql`.
2. Verify:
   ```sql
   select (select extversion from pg_extension where extname='vector') as pgvector,
          (select count(*) from public.kb_chunks) as rows,
          (select count(*) from pg_proc where proname='match_kb_chunks') as search_fn;
   ```
3. Load the knowledge (section 7).

---

## 5. Run locally

### 5.1 Start the servers (four terminals)

```bash
# ai-agents  → http://localhost:8000   (docs: /docs)
cd apps/ai-agents && .venv/Scripts/python -m uvicorn app.main:app --port 8000 --reload
#   macOS/Linux: .venv/bin/python …   or: uv run uvicorn app.main:app --port 8000 --reload

# API        → http://localhost:3001
cd apps/api && pnpm dev

# Dashboard  → http://localhost:3000
cd apps/dashboard && pnpm dev

# Customer demo (call / email / web) → http://localhost:3003
cd apps/customer-demo && pnpm dev
```

### 5.2 Turn memory on/off

Add or edit in the **repo-root** `.env.local`, then **restart ai-agents**
(`--reload` watches code, not env files):

```bash
KNOWLEDGE_SOURCE=vector   # on
KNOWLEDGE_SOURCE=static   # off
```

### 5.3 Check it works

```bash
curl -X POST localhost:3001/api/tools/search_knowledge \
  -H 'content-type: application/json' -d '{"query":"do you ship to Vietnam"}'
```

- `"enabled":true` + results → working end to end (API → ai-agents → Supabase).
- `"enabled":false` → `KNOWLEDGE_SOURCE` is not `vector` or ai-agents wasn't restarted.

Email / web form: submit from http://localhost:3003, open the draft on the dashboard.

### 5.4 Voice calls against your laptop

Vapi can only reach your machine through a public tunnel.

1. Start the tunnel to the API (reserved ngrok domain = `PUBLIC_BACKEND_URL`):
   ```bash
   ngrok http --url=<your-ngrok-domain> 3001
   ```
2. Make sure the assistant's webhook points at it (dry run first, then apply):
   ```bash
   cd apps/vapi-setup
   pnpm vapi:inspect                     # shows tools + serverUrl
   pnpm vapi:update-webhook              # dry run
   pnpm vapi:update-webhook:apply
   ```
3. Make sure the assistant has the tool (one-time; same assistant id, in place):
   ```bash
   pnpm vapi:add-tool -- search_knowledge          # dry run
   pnpm vapi:add-tool:apply -- search_knowledge    # backup saved to apps/vapi-setup/backups/
   ```
4. Call from http://localhost:3003/call and ask e.g. *"Do you ship to Vietnam?"*.

> While the webhook points at ngrok, **every** call to that assistant (including
> from the Vercel demo) goes to your laptop. Point it back to Vercel when done.

> Do **not** use `pnpm vapi:recreate:apply` for this — it deletes the assistant
> and creates a new id, which breaks every app configured with the old id.

---

## 6. Run in the cloud (Vercel)

1. Merge to `main` (production auto-deploy) or push a branch (preview deploy).
2. Vercel → **ai-agents** project → Settings → Environment Variables:
   `KNOWLEDGE_SOURCE = vector` for the environment you deploy (Production and/or
   Preview). **Redeploy** — env changes apply only to new deployments.
3. Point Vapi at the Vercel API: set `PUBLIC_BACKEND_URL=https://<api>.vercel.app`
   in `.env.local`, then `pnpm vapi:update-webhook` → `pnpm vapi:update-webhook:apply`.
4. Make sure the assistant has the `search_knowledge` tool (`pnpm vapi:inspect`; add with 5.4 step 3 if missing).
5. Verify without a phone:
   ```bash
   curl -X POST https://<api>.vercel.app/api/tools/search_knowledge \
     -H 'content-type: application/json' -d '{"query":"do you ship to Vietnam"}'
   ```
6. Call from the deployed customer demo; check Vercel logs (API: `search_knowledge`,
   ai-agents: `POST /tools/search_knowledge`).

Notes:
- Preview deployments behind Vercel Deployment Protection return 401 to Vapi — test calls on production or disable protection for that preview.
- Vercel never loads knowledge. Ingest runs from a laptop or CI (section 7); Vercel sees new data immediately, no redeploy.

### Local vs cloud at a glance

| | Local | Cloud |
|---|---|---|
| Memory switch | repo-root `.env.local` + restart ai-agents | Vercel ai-agents env var + redeploy |
| Memory data | Supabase `kb_chunks` (same table) | Supabase `kb_chunks` (same table) |
| Vapi webhook | ngrok URL → `localhost:3001` | `https://<api>.vercel.app` |
| Load knowledge | `python -m app.memory.ingest` | same command, from laptop/CI |
| Logs | terminal windows | Vercel project logs |

---

## 7. Add or change knowledge

1. Edit or add markdown under `knowledge/` (any subfolder). Use `## Question`
   headings with the answer below — each heading becomes its own chunk.
   Only put **customer-safe** content here; anything in `knowledge/` can be spoken to callers.
2. Load it (incremental — only new/changed chunks are embedded, removed ones are deleted):
   ```bash
   cd apps/ai-agents
   .venv/Scripts/python -m app.memory.ingest     # or: uv run python -m app.memory.ingest
   # → ingested N files: {'added': x, 'removed': y, 'unchanged': z}
   ```
   It refuses to run if it finds no knowledge files (so it can never empty the table).
3. Cost: ~214 chunks ≈ $0.001 to embed in full; re-runs only pay for changes.

## 8. Roll back

| Scope | Action |
|---|---|
| Turn memory off | `KNOWLEDGE_SOURCE=static` (local: restart ai-agents; Vercel: redeploy) |
| Remove the voice tool | PATCH the assistant with a backup from `apps/vapi-setup/backups/` (body `{ "model": <backup> }`) |
| Remove the database objects | run `migrations/memory/0001_kb_chunks.down.sql` (keeps the `vector` extension) |
| Remove the code | revert the `feat/cs-memory` merge |

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `enabled:false` | `KNOWLEDGE_SOURCE` not `vector`, or ai-agents not restarted / redeployed |
| `enabled:true` but `results: []` | question not covered (match threshold 0.3), or knowledge not ingested — check `select count(*) from kb_chunks` |
| `error: upstream_unavailable` | API can't reach ai-agents — check `PYTHON_AI_URL` and that ai-agents is up |
| Call never uses memory | assistant lacks the tool (`pnpm vapi:inspect`), or the webhook points elsewhere (`serverUrl`) |
| Call reaches laptop instead of Vercel | webhook still on ngrok — run `vapi:update-webhook:apply` with the Vercel URL |
| Ingest error `relation "kb_chunks" does not exist` | migration not applied to this Supabase project |
| Ingest error `no knowledge chunks found` | run from `apps/ai-agents`; `knowledge/` missing or empty |

## 10. Live product catalogue (Shopify Storefront)

Price, sale price, stock per variant and product link for a **named product**,
used by the voice tool `search_products`. Plan: [plans/2026-11-14-shopify-catalog.md](plans/2026-11-14-shopify-catalog.md).

| | |
|---|---|
| Switch | `CATALOG_SOURCE=off` (default) / `shopify` — same place and restart rules as `KNOWLEDGE_SOURCE` |
| Credentials | `SHOPIFY_STORE`, `SHOPIFY_STOREFRONT_TOKEN` (reused from the Shopify chatbot; read-only), optional `SHOPIFY_API_VERSION` (default `2026-07`) |
| Code | `apps/ai-agents/app/catalog/` · `POST /tools/search_products` · API `POST /api/tools/search_products` |
| Vapi | `pnpm vapi:add-tool:apply -- search_products` (already applied to the current assistant) |
| Speed | ~0.3–0.6 s per lookup (Shopify title search), cached 5 min per question |

Check: `curl -X POST localhost:3001/api/tools/search_products -H 'content-type: application/json' -d '{"query":"kosmos pro v"}'`

Behaviour: every product word must appear in the title (so "pro v" finds only Pro V
paddles); filler words ("is", "in stock", "price") are dropped; spoken "pro five/four"
becomes "Pro V/IV"; test/GovX/sample products are hidden. If Shopify fails or the
switch is off the tool returns `enabled:false` and the assistant offers an email follow-up.

Cloud: add `CATALOG_SOURCE=shopify`, `SHOPIFY_STORE`, `SHOPIFY_STOREFRONT_TOKEN` to the
Vercel **ai-agents** project and redeploy.

Not supported yet: browsing ("what's on sale?"), order status (still seeded data —
needs the Shopify Admin API), using stock inside email/web drafts.

## 11. Known limitations

- No separate dev/staging Supabase: local development uses production (see the warning in section 1).
- `Shopify-Chatbot/` may sit in the repo folder as a reference checkout; it is git-ignored
  (separate Bitbucket repo with a real `.env`) and must never be committed.

- Non-warranty emails still get the standard acknowledgement (no AI, no memory).
- ai-agents endpoints have no auth (existing pattern); each memory search costs a
  small OpenAI embedding — keep the ai-agents URL private or add a shared secret.
- Some knowledge answers contain past dates ("late 2024") — needs CS content review.
- `joola_internal_policies.md` from the chatbot was deliberately **not** imported
  (looks like test content) until CS confirms it is real policy.
