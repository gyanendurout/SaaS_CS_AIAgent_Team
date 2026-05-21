# JOOLA AI CS Warranty Management System

Voice-first customer support for warranty claims. A customer speaks to an AI agent in the browser; a deterministic policy engine evaluates eligibility; the dashboard gives ops full visibility in real time.

---

## Architecture

```
                                    +----------------------+
                                    |     OpenAI           |
                                    | GPT-4o / Whisper/TTS |
                                    +----------+-----------+
                                               ^
                                               |
+----------+      WebRTC      +-----------+    |    +------------------+
| Browser  | <--------------> |   Vapi    |    |    |  Python LangGraph|
| (Next.js | <-- Realtime --+ |  Voice    |    |    |  (apps/ai-agents)|
|  on      |                | |  Agent    |    |    |  Railway svc 2   |
|  Vercel) |                | +-----+-----+    |    +---------+--------+
+----+-----+                |       |          |              ^
     |                      |       v          v              |
     | REST + WS            |   +--------------+--------------+
     v                      |   |     Fastify TypeScript API  |
+----+----------+           |   |     (apps/api, Railway 1)   |
|  Dashboard    |           |   |     Policy Engine + Webhooks|
|  (apps/       |           |   +--------------+--------------+
|  dashboard)   | <---------+                  |
+---------------+        Supabase Realtime     v
                         (CDC channels)   +----+----+
                                          |Supabase |
                                          | Postgres|
                                          | Storage |
                                          +---------+
```

---

## Project structure

```
SaaS_CS_AIAgent_Team/
├── apps/
│   ├── dashboard/         # Next.js 14 (App Router) — ops UI, Vercel
│   ├── api/               # Fastify TypeScript — REST + webhooks, Railway
│   └── ai-agents/         # Python 3.11 + LangGraph — agent orchestration, Railway
├── packages/
│   ├── types/             # Shared TS types (@joola/types)
│   └── ui/                # Shared React components (@joola/ui)
├── migrations/            # Supabase SQL migrations (0001_initial_schema.sql, ...)
├── docs/
│   ├── brd/               # Business requirements
│   ├── design/            # Architecture & UX
│   └── policies/          # Warranty policy v1.0.0
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Quick start

### Prerequisites

| Tool    | Version  | Why                                          |
| ------- | -------- | -------------------------------------------- |
| Node    | >= 20    | Next.js 14 + Fastify runtime                 |
| Python  | >= 3.11  | LangGraph agents                             |
| pnpm    | >= 9     | Workspace package manager                    |
| ngrok   | latest   | Expose local Fastify to Vapi webhooks (dev)  |

### Setup

```bash
# 1. Install JS dependencies
pnpm install

# 2. Set up Python venv for agents
cd apps/ai-agents
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cd ../..

# 3. Configure env vars
cp .env.example .env.local
# edit .env.local — fill in Supabase, OpenAI, Vapi keys

# 4. Apply database migrations (via Supabase CLI or psql)
psql "$DIRECT_URL" -f migrations/0001_initial_schema.sql

# 5. Start an ngrok tunnel for Vapi webhooks (separate shell)
ngrok http 4000
# copy the https URL into PUBLIC_BACKEND_URL in .env.local
```

### Run locally

```bash
# starts dashboard (3000), api (4000), and ai-agents in parallel
pnpm dev
```

| Service     | URL                       |
| ----------- | ------------------------- |
| Dashboard   | http://localhost:3000     |
| Fastify API | http://localhost:4000     |
| AI agents   | http://localhost:8000     |

---

## Tech decisions

- **Supabase** — Postgres + Realtime + Storage in one managed service; CDC channels let the dashboard subscribe to new tickets with zero polling.
- **LangGraph** — Stateful, graph-based agent orchestration; deterministic transitions over plain prompt chains, easier to audit during demos.
- **Vapi** — Browser-native WebRTC voice agent; offloads STT/TTS plumbing so we focus on conversation logic and policy reasoning.
- **Deterministic rule engine** — Warranty eligibility is decided by code, not the LLM. The agent gathers facts; a pure TypeScript function in `apps/api` returns the verdict so every decision is reproducible and explainable.
- **Policy version 1.0.0** — Pinned in `POLICY_VERSION`; every claim record stores the policy version it was evaluated under so historical decisions stay traceable when the policy evolves.

---

## Deployment

| Layer      | Platform          | Trigger                                  |
| ---------- | ----------------- | ---------------------------------------- |
| Dashboard  | Vercel            | Auto-deploy on push to `main`            |
| API        | Railway (svc 1)   | Auto-deploy on push, builds from Dockerfile |
| AI agents  | Railway (svc 2)   | Auto-deploy on push, Python buildpack    |
| Database   | Supabase (managed)| Migrations via CI or `psql` against `DIRECT_URL` |
| Source     | GitHub            | Branch protection on `main`              |

---

## Demo flow

1. Customer opens the dashboard's public claim page in a browser.
2. Clicks "Start voice call" — Vapi establishes WebRTC, the AI agent greets and gathers order ID, issue, and purchase date.
3. The API's policy engine evaluates eligibility against policy v1.0.0 and returns an outcome (approve / deny / human review).
4. A `tickets` row is inserted in Supabase; the ops dashboard receives it via Realtime and renders the new card with the full transcript and decision rationale.
5. Ops can review, override, or message the customer back — all changes stream live.

---

## Docs

- [Business requirements](./docs/brd/)
- [Architecture & design](./docs/design/)
- [Warranty policy v1.0.0](./docs/policies/)
