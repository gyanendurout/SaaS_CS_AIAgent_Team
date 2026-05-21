# JOOLA AI CS Warranty Management — Runbook

Operations guide for running the demo locally. Last updated 2026-05-18.

---

## 1. Quick start (TL;DR — if you've done this before)

```powershell
# Terminal 1 — ngrok tunnel (must be running before Vapi voice works)
ngrok http 3001

# Terminal 2 — start all 4 services
cd c:\Workspace\SaaS_CS_AIAgent_Team
.\start-all.ps1   # see section 5 — or run the 4 commands manually below
```

URLs:
- **Dashboard (CS ops view)** → http://127.0.0.1:3000/live
- **Customer demo** → http://127.0.0.1:3003
- **API health** → http://127.0.0.1:3001/health
- **Python health** → http://127.0.0.1:8000/health

---

## 2. Project structure

```
SaaS_CS_AIAgent_Team/
├── apps/
│   ├── dashboard/        Next.js 14 — CS ops dashboard (/live + /archive)  [port 3000]
│   ├── customer-demo/    Next.js 14 — customer-facing app (voice/email/web) [port 3003]
│   ├── api/              Fastify TS — orchestration + Vapi webhook + tools  [port 3001]
│   ├── ai-agents/        Python + LangGraph 7-agent pipeline + OpenAI       [port 8000]
│   └── vapi-setup/       One-shot scripts: inspect, recreate, create-fresh, update-webhook
├── packages/
│   ├── warranty-policy/  Python rule engine v1.0.0 (zero LLM)
│   └── vapi-assistant-config/  System prompt + 5 tool schemas (JSON)
├── migrations/
│   ├── 0001_initial_schema.sql       12 tables, 11 enums, 7 agents, RLS, Realtime publication
│   ├── 0002_seed_demo.sql            33 customers + 60 orders + 280 claims (covers all §4 edge cases)
│   └── 0003_rpc_functions.sql        archive_query, archive_aggregates, dashboard_kpi, claim_pipeline_summary
├── docs/
│   ├── brd/JOOLA_AI_CS_Warranty_Management_BRD.md
│   ├── policies/cs-knowledge-base-v1.md  Policy v1.0.0 — source of truth for rule engine + Vapi
│   └── design/           Original React prototype (reference)
├── .env.local            All secrets (gitignored; do not commit)
├── .env.example          Template
├── package.json          Turborepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json
└── RUNBOOK.md            This file
```

---

## 3. Prerequisites — one-time install

| Tool | Version | How |
|---|---|---|
| Node.js | 20+ LTS | https://nodejs.org |
| Python | 3.11+ (3.12 ideal) | https://python.org |
| pnpm | 9.15+ | `npm install -g pnpm@9.15.0` (avoid corepack on Windows — needs admin) |
| ngrok | 3+ | https://ngrok.com/download then `ngrok config add-authtoken <yours>` |

Verify:
```powershell
node --version    # >= v20
python --version  # >= 3.11
pnpm --version    # >= 9.15
ngrok --version   # >= 3.0
```

---

## 4. First-time setup (run once per machine)

### 4.1 Install Node dependencies
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team
pnpm install
```
Takes ~1–2 min. Installs all 5 app workspaces + packages.

### 4.2 Install Python dependencies
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\ai-agents
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ..\..\packages\warranty-policy
pip install -e ".[dev]"
python -c "from warranty_policy import __POLICY_VERSION__; print(__POLICY_VERSION__)"
# Should print: 1.0.0
```

### 4.3 Build `.env.local` (project root)

Required keys (see section 4.4 for where to grab each):

```bash
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://isrcdvhtfnbzlnvhgule.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://isrcdvhtfnbzlnvhgule.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.isrcdvhtfnbzlnvhgule.supabase.co:6543/postgres
DIRECT_URL=postgresql://postgres:<PASSWORD>@db.isrcdvhtfnbzlnvhgule.supabase.co:5432/postgres

# --- OpenAI ---
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o

# --- Vapi ---
VAPI_API_KEY=<vapi dashboard → API keys>
VAPI_ASSISTANT_ID=397c019b-f428-4709-9473-2c102009a654
VAPI_WEBHOOK_SECRET=<vapi dashboard → assistant server URL secret>
NEXT_PUBLIC_VAPI_PUBLIC_KEY=<vapi dashboard → API keys → Public Key>
NEXT_PUBLIC_VAPI_ASSISTANT_ID=397c019b-f428-4709-9473-2c102009a654

# --- ngrok / public URL ---
PUBLIC_BACKEND_URL=https://uncoated-oxymoron-written.ngrok-free.dev

# --- App config ---
DEMO_MODE=true
POLICY_VERSION=1.0.0
NODE_ENV=development
LOG_LEVEL=INFO

# --- Inter-service URLs (local dev) ---
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_POLICY_VERSION=1.0.0
PYTHON_AI_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://localhost:3003
```

### 4.4 Where to find each secret

| Key | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Settings → API → "publishable keys" tab |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard → Settings → API → "secret keys" tab |
| `DATABASE_URL` / `DIRECT_URL` password | Supabase Dashboard → Settings → Database → Reset password |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `VAPI_API_KEY` | https://dashboard.vapi.ai → API Keys (private key) |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | https://dashboard.vapi.ai → API Keys (public key — for browser SDK) |
| `VAPI_ASSISTANT_ID` | Created by `pnpm tsx apps/vapi-setup/src/create-fresh.ts --apply` |
| `VAPI_WEBHOOK_SECRET` | https://dashboard.vapi.ai → Assistant → Server URL → Secret |

### 4.5 Copy `.env.local` into each app dir

Next.js + Fastify don't read parent dir env files, so they each need a copy:
```powershell
$root = 'c:\Workspace\SaaS_CS_AIAgent_Team'
@('dashboard','customer-demo','api','vapi-setup') | ForEach-Object {
  Copy-Item "$root\.env.local" "$root\apps\$_\.env.local" -Force
}
```
**Re-run this every time you change `.env.local`.** Python `apps/ai-agents` reads from project root directly.

### 4.6 Run all 3 migrations in Supabase SQL Editor

Open https://supabase.com/dashboard/project/isrcdvhtfnbzlnvhgule/sql/new and run in order:

1. Paste [migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql) → Run (~5 sec)
2. Paste [migrations/0002_seed_demo.sql](migrations/0002_seed_demo.sql) → Run (~15 sec — seeds 280 claims)
3. Paste [migrations/0003_rpc_functions.sql](migrations/0003_rpc_functions.sql) → Run (~5 sec)

Verify:
```sql
set search_path = public, pg_catalog;
select count(*) from claims;        -- 280
select * from dashboard_kpi;        -- 1 row of KPIs
select * from claim_pipeline_summary;  -- 5 stages
```

### 4.7 Create the JOOLA Vapi assistant (only if you don't have one yet)

If `VAPI_ASSISTANT_ID` is empty in `.env.local`:
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\vapi-setup
pnpm tsx src/create-fresh.ts            # dry run — shows payload
pnpm tsx src/create-fresh.ts --apply    # actually creates it
```
Copy the printed assistant ID into BOTH `VAPI_ASSISTANT_ID` and `NEXT_PUBLIC_VAPI_ASSISTANT_ID` in `.env.local`, then re-run section 4.5 to sync.

---

## 5. Daily startup — bring all services up

Run each in a separate PowerShell window. Order matters (ai-agents → api → ngrok → Next.js apps).

### 5.1 Window 1 — Python ai-agents (port 8000)
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\ai-agents
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5.2 Window 2 — Fastify API (port 3001)
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\api
pnpm dev
```

### 5.3 Window 3 — ngrok tunnel (public URL → port 3001)
```powershell
ngrok http 3001
```
- Note the `https://*.ngrok-free.dev` URL from the ngrok UI.
- **If it differs from what's in `.env.local`**, update `PUBLIC_BACKEND_URL` there + re-sync (section 4.5) + run `pnpm tsx apps/vapi-setup/src/update-webhook.ts --apply` to update Vapi.
- ngrok free accounts get one persistent static URL — usually stays the same across restarts.

### 5.4 Window 4 — Next.js dashboard (port 3000)
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\dashboard
pnpm dev
```

### 5.5 Window 5 — Next.js customer-demo (port 3003)
```powershell
cd c:\Workspace\SaaS_CS_AIAgent_Team\apps\customer-demo
pnpm dev
```

### 5.6 Verify everything is up
```powershell
@(@{N='ai-agents'; U='http://127.0.0.1:8000/health'},
  @{N='api';       U='http://127.0.0.1:3001/health'},
  @{N='dashboard'; U='http://127.0.0.1:3000/live'},
  @{N='cust-demo'; U='http://127.0.0.1:3003/'}) |
ForEach-Object {
  try { $r = Invoke-WebRequest -Uri $_.U -TimeoutSec 30 -UseBasicParsing
        Write-Host "$($_.N) : HTTP $($r.StatusCode)" -ForegroundColor Green }
  catch { Write-Host "$($_.N) : ERROR" -ForegroundColor Red }
}
```
All four should show HTTP 200.

---

## 6. Demo flow — what to click for the CEO

### 6.1 Voice (most impressive — needs Vapi + ngrok)
1. Open http://127.0.0.1:3003/call in browser A
2. Open http://127.0.0.1:3000/live in browser B (side-by-side)
3. Pick a customer identity in browser A's header (e.g., "Mateo Gagnon")
4. Click **Start call** → grant mic permissions
5. Say: *"Hi, my paddle is cracked. My order number is 1234 and I bought it from JOOLA.com."*
6. Watch browser B — agents light up (intake → shopify → warrreg → rules → summary → response), feed shows the new claim, drawer opens with decision + draft
7. Customer hears: *"I'm sorry your paddle is cracked. I found your order — you're covered..."*

### 6.2 Email (no Vapi needed)
1. Open http://127.0.0.1:3003/email
2. Compose: To `support@joola.com`, Subject `Cracked paddle`, Body `My paddle is cracked, order #1234`
3. Click **Send**
4. Watch dashboard `/live` → new claim appears in LiveFeed
5. AI processes → outbound email lands back in customer inbox (`/email` Realtime updates)

### 6.3 Web form (no Vapi needed)
1. Open http://127.0.0.1:3003/web → fill out form → submit
2. Watch dashboard → status card updates as AI processes

### 6.4 Archive + reopen
1. Open http://127.0.0.1:3000/archive
2. Filter to `Decision = NOT_ELIGIBLE` → click a row → drawer opens
3. Click **Reopen → Live** → modal asks for category + note
4. Submit → ticket flips to REOPENED, view auto-switches to `/live`, claim re-enters intake

### 6.5 CSV export
On `/archive` → click **EXPORT CSV ⇣** → browser downloads filtered set (cap 10k rows).

---

## 7. Troubleshooting

### Dashboard `/archive` shows "Could not find the function public.archive_query"
PostgREST schema cache is stale. In Supabase SQL Editor:
```sql
set search_path = public, pg_catalog;
grant execute on function archive_query(text, int, channel_type, decision_type, text, display_status_type, boolean, boolean, boolean, int, int) to anon, authenticated, public;
grant execute on function archive_aggregates(jsonb) to anon, authenticated, public;
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
```
If that doesn't work, restart PostgREST via Supabase Dashboard → Settings → API → Restart.

### Fastify api won't start — "Invalid environment configuration: SUPABASE_URL Required..."
`apps/api/.env.local` is missing or stale. Re-run section 4.5 to sync.

### Vapi voice doesn't respond / says network error
Either:
- ngrok tunnel is down → check ngrok window, restart if needed
- Vapi assistant points at wrong URL → run `pnpm tsx apps/vapi-setup/src/inspect.ts` to see current `serverUrl`. If wrong, run `pnpm tsx apps/vapi-setup/src/update-webhook.ts --apply` after updating `PUBLIC_BACKEND_URL` in `.env.local`.

### Vapi assistant won't recreate — "name does not contain 'joola'"
Safety guard caught a non-JOOLA assistant. Two fixes:
- Rename the assistant in Vapi dashboard to include "joola"
- OR use `create-fresh.ts` instead of `recreate.ts` (creates new without touching existing)

### Realtime not updating on dashboard
Check Supabase Dashboard → Database → Replication → make sure these tables have Realtime enabled: `claims`, `agent_states`, `escalations`, `transcripts`, `emails`, `drafts`. If not:
```sql
alter publication supabase_realtime add table public.claims;
-- repeat for each
alter table claims replica identity full;
```

### Customer-demo voice page errors about VAPI_PUBLIC_KEY
`NEXT_PUBLIC_VAPI_PUBLIC_KEY` is missing or wrong in `apps/customer-demo/.env.local`. Get it from Vapi dashboard → API Keys → **Public Key** (different from API key). Re-sync env (section 4.5), restart customer-demo.

### Python ai-agents import error: "No module named 'warranty_policy'"
Editable install of workspace package didn't take. From `apps/ai-agents`:
```powershell
.\.venv\Scripts\Activate.ps1
pip install -e ..\..\packages\warranty-policy
```

### "Address already in use" on any port
Old process from previous session. Kill it:
```powershell
$port = 3000  # or 3001, 3003, 8000
Get-NetTCPConnection -LocalPort $port -State Listen -EA SilentlyContinue |
  Select -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Migration 0001 errors: "cannot use subquery in column generation expression"
You're running an old version. Pull latest [migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql) — fixed by using a trigger instead of a generated column.

### Migration 0003 errors: "type channel_type does not exist"
Old version of 0003. The fix is `set search_path = public, pg_catalog;` at the top + `set search_path` on every function definition. Pull latest.

---

## 8. Shutdown — clean stop

```powershell
# Kill all 4 app processes by port
@(3000, 3001, 3003, 8000) | ForEach-Object {
  $port = $_
  Get-NetTCPConnection -LocalPort $port -State Listen -EA SilentlyContinue |
    Select -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -EA SilentlyContinue }
}

# Kill ngrok
Get-Process ngrok -EA SilentlyContinue | Stop-Process -Force
```

---

## 9. Architecture summary

```
Customer browser
  ├─ /call  ──→ Vapi Web SDK ──→ Vapi cloud (assistant 397c019b-...)
  │                                  │
  │                                  ↓ webhook (HMAC verified)
  │                              ngrok URL
  │                                  │
  │                                  ↓
  ├─ /email ──HTTP──┐            ┌── Fastify API (port 3001)
  └─ /web   ──HTTP──┤            │    ├─ /webhooks/vapi
                    └────────────┤    ├─ /api/tools/* (5 tools)
                                 │    ├─ /api/customer/* (intake)
                                 │    ├─ /api/cases/:id/reopen
                                 │    └─ /api/archive/export.csv
                                 │
                                 ↓ HTTP for AI work
                              Python ai-agents (port 8000)
                                 ├─ /pipeline/run → LangGraph 7-node graph
                                 │     intake → shopify → warrreg → rules
                                 │     → summary → {response | esc}
                                 ├─ /tools/* (5 tool endpoints)
                                 └─ imports warranty_policy (deterministic rules)
                                 │
                                 ↓ all writes go here
                              Supabase (managed Postgres)
                                 ├─ 12 tables (claims, customers, …)
                                 ├─ 6 Realtime-enabled tables
                                 └─ 4 RPCs + 3 views
                                 │
                                 ↓ Realtime subscriptions
                              CS Lead browser
                                 └─ Dashboard (port 3000)
                                      ├─ /live (3-col ops view)
                                      └─ /archive (filter + analytics)
```

**Decision layer**:
- All eligibility decisions go through `packages/warranty-policy` (Python, deterministic, zero LLM)
- Only the Customer Reply agent (06) uses GPT-4o, for drafting the actual reply text
- Policy version 1.0.0 anchored in every `case_events` audit row

---

## 10. Before deploying to production

- [ ] **Rotate all exposed keys** (OpenAI, Supabase secret, Vapi API, Vapi webhook)
- [ ] **Wire Supabase Auth** — currently RLS uses single permissive policy for anon role
- [ ] **Replace mock connectors with real Shopify + Warranty DB** (set `DEMO_MODE=false`)
- [ ] **Move ngrok URL → permanent Railway URL** + run `update-webhook.ts --apply`
- [ ] **Set up Railway deployment** for `apps/api` + `apps/ai-agents`
- [ ] **Set up Vercel deployment** for `apps/dashboard` + `apps/customer-demo`
- [ ] **Configure Sentry / observability** (currently skipped for demo)
- [ ] **Tighten RLS policies** (per-user instead of demo-anon-all)
- [ ] **Set up scheduled retention cleanup** (delete claims > 30 days via pg_cron)
- [ ] **Bump `policy_version`** when JOOLA policy doc updates → keep historical attribution

---

## 11. Quick reference — useful commands

```powershell
# Re-sync env after editing .env.local
$root = 'c:\Workspace\SaaS_CS_AIAgent_Team'
@('dashboard','customer-demo','api','vapi-setup') | ForEach-Object {
  Copy-Item "$root\.env.local" "$root\apps\$_\.env.local" -Force
}

# Inspect current Vapi assistant
cd apps\vapi-setup; pnpm tsx src/inspect.ts

# Update Vapi assistant webhook URL after ngrok URL changes
cd apps\vapi-setup; pnpm tsx src/update-webhook.ts --apply

# Create a fresh Vapi assistant (when current is misconfigured)
cd apps\vapi-setup; pnpm tsx src/create-fresh.ts --apply

# Run rule engine tests
cd packages\warranty-policy; pytest

# Type-check all TS apps
pnpm typecheck

# Run a one-off query against Supabase from the SQL Editor
# (always start with `set search_path = public, pg_catalog;`)
```

---

**This runbook + the files at the paths it references are the complete operational state.** If you walk away and come back in 6 months: install prerequisites (section 3), follow first-time setup (section 4), then daily startup (section 5). Demo flows (section 6) will work.
