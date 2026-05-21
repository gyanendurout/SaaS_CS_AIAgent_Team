# @joola/dashboard

CS Lead's live operations dashboard for the JOOLA Warranty AI system.

A read-only Next.js 14 App Router app that visualizes:

- 7 AI agents working in parallel (Intake -> Shopify -> Warranty Reg -> Rules -> Summary -> Reply -> Escalation)
- Live inbound activity (voice / email / web) with real-time Supabase subscriptions
- Pipeline funnel across 5 stages (intake / verify / rules / draft / closed)
- Human escalation queue + decision-mix breakdown
- Historical archive with deep filtering, side analytics, and CSV export

The dashboard does NOT execute work — it only observes Postgres (via Supabase Realtime)
and triggers two side effects through `apps/api`:

- `POST /api/cases/:id/reopen` — re-route a closed ticket back into the live feed
- `GET  /api/archive/export.csv` — download a filtered claim set as CSV

## Stack

- Next.js 14.2+ (App Router, RSC, standalone output for Vercel)
- React 18 + TypeScript 5.4 strict
- Tailwind CSS 3.4 with JOOLA design tokens (see `tailwind.config.ts` + `globals.css`)
- `@supabase/supabase-js` v2 (Realtime + RPC)
- `@tanstack/react-query` v5 (Archive RPC fetch + aggregate caching)

## Routes

- `/` -> 302 redirect to `/live`
- `/live` -> 3-column ops view (Agents | Active calls + Live feed | Pipeline + Escalations) + KPI strip
- `/archive` -> filterable historical table + side analytics (URL-driven filters)
- `?case=WC-XXXXX` -> opens the case detail drawer on either route (deep-linkable)

## Environment

Copy `.env.example` to the project root's `.env.local`. Required vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon / publishable, NOT the secret key)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_POLICY_VERSION`

## Local dev

```bash
pnpm install
pnpm --filter @joola/dashboard dev
```

## Deploy

Vercel project. Root Directory = `apps/dashboard`. Build command auto-detected.
