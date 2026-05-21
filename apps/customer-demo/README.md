# JOOLA Customer Demo

The customer-facing companion app for the JOOLA AI CS demo. The CS Lead opens this in a second browser tab during the CEO demo and plays the role of a customer across three channels: **voice**, **email**, and **web form**.

## What this app does

- **Voice** (`/call`) — Browser-based voice call powered by the Vapi Web SDK. The customer (CS Lead) speaks into their mic; the JOOLA AI voice assistant answers. Live waveform + transcript visible on screen.
- **Email** (`/email`) — A simple inbox + compose pane. Sending an email POSTs to the backend's `/api/customer/email/inbound` endpoint, which fires the AI agent pipeline. Replies arrive via Supabase Realtime on the `emails` table.
- **Web form** (`/web`) — A customer-service form (order #, product, issue, photos). Submitting POSTs to `/api/customer/web/inbound` and returns a `claim_id`; the case status card subscribes to claim updates so the CS Lead can see the AI's response land in real time.

The CS Lead can also switch between seeded customer identities (Sarah Patel, Marcus Yen, etc.) via a header dropdown, so the demo can exercise every policy path: NFC paddle, unauthorized seller, signed-for damaged table, etc.

## Theme

Light, customer-friendly — **not** the ops dark theme of the dashboard. Uses the JOOLA brand tokens (white / paper background, near-black ink, yellow `#F5E625` accent, Archivo typeface).

## Routes

| Route | Purpose |
|---|---|
| `/` | Welcome page with 3 channel cards |
| `/call` | Voice channel (Vapi Web SDK) |
| `/email` | Email channel (inbox + compose) |
| `/web` | Web form channel (form + case status) |

## Environment

Copy `.env.example` to `.env.local`. All variables are `NEXT_PUBLIC_*` because this is a pure browser client.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_VAPI_PUBLIC_KEY=   # from Vapi dashboard — NOT the secret API key
NEXT_PUBLIC_VAPI_ASSISTANT_ID= # from packages/vapi-assistant-config
```

## Local dev

```bash
pnpm install
pnpm --filter @joola/customer-demo dev
```

The app runs at <http://localhost:3003>.

## Deploy (Vercel)

- Root Directory: `apps/customer-demo`
- Build Command: `next build`
- Install Command: `pnpm install --frozen-lockfile`
- Set the same env vars in the Vercel project settings.

## What it does NOT do

- It does **not** subscribe to dashboard tables (`claims`, `agent_states`, `escalations`) — that is the dashboard app's job.
- It does **not** call any service-role / secret keys. Only public-key Vapi + Supabase anon.
- It does **not** mutate any data on submission — all mutations flow through the FastAPI backend so the agent pipeline owns claim lifecycle.
