# @joola/api

Fastify (TypeScript) orchestration layer between:

- **Vapi** (voice) — webhooks + 5 tool endpoints
- **Customer demo** (email/web intake) — kicks off the Python AI pipeline
- **Dashboard** — case lifecycle (reopen, approve, escalate) + CSV exports
- **Python AI agents** — proxies eligibility/pipeline calls
- **Supabase** — service-role client, audits every meaningful action to `case_events`

## Quick start

```bash
pnpm install
cp apps/api/.env.example .env.local   # fill in values at repo root
pnpm --filter @joola/api dev
```

Defaults to port `3001`. Override with `PORT`.

## Endpoint surface

| Method | Path                                  | Purpose                                                |
| ------ | ------------------------------------- | ------------------------------------------------------ |
| GET    | `/health`                             | Liveness probe                                         |
| POST   | `/webhooks/vapi`                      | Vapi event router (transcript / function-call / end)  |
| POST   | `/api/tools/lookup_order`             | Vapi tool                                              |
| POST   | `/api/tools/check_warranty_registration` | Vapi tool                                           |
| POST   | `/api/tools/evaluate_eligibility`     | Vapi tool → proxies to Python                         |
| POST   | `/api/tools/create_claim`             | Vapi tool                                              |
| POST   | `/api/tools/escalate_to_human`        | Vapi tool                                              |
| POST   | `/api/customer/voice/start`           | Optional pre-call hint (Vapi SDK handles direct)       |
| POST   | `/api/customer/email/inbound`         | Customer demo email → claim + pipeline                 |
| POST   | `/api/customer/web/inbound`           | Customer demo web form → claim + pipeline              |
| POST   | `/api/cases/:id/reopen`               | CS Lead reopens with category + note                   |
| POST   | `/api/cases/:id/approve-draft`        | CS Lead approves an AI-drafted reply                   |
| POST   | `/api/cases/:id/escalate`             | CS Lead escalates manually                             |
| GET    | `/api/archive/export.csv`             | Streams CSV via Postgres `archive_export(filters)`     |

## Deployment

- Railway: Service Root = `apps/api`, Start Command = `pnpm start` (after `pnpm build`).
- All env vars come from Railway dashboard in prod; from repo `.env.local` in dev.

## Conventions

- Zod validates every request body.
- Every meaningful endpoint writes at least one `case_events` row via `fastify.audit(...)`.
- All Supabase access uses the service role client (bypasses RLS — we own the gate).
- No business logic lives in route handlers — extract to functions in `lib/` or `plugins/`.
- Pino logger with `pino-pretty` in dev.

## Files NOT to touch

- `apps/dashboard`, `apps/customer-demo`, `apps/ai-agents`, `packages/*`, `migrations/*`.
