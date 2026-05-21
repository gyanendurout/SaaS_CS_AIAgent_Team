# @joola/vapi-setup

Safety-gated CLI scripts for managing the **JOOLA CS Warranty** Vapi assistant.

## Why this exists

The Vapi API key (`VAPI_API_KEY`) used by this project is scoped to a Vapi organization that may contain **other assistants** unrelated to JOOLA. Calling the Vapi API carelessly (e.g., listing all assistants and acting on each) could break unrelated production assistants.

These scripts are deliberately conservative:

- They **only ever touch the assistant whose ID is in `VAPI_ASSISTANT_ID`** — never enumerate, never act on "all assistants".
- Before any destructive call they **GET** the assistant first and assert its name contains `joola` (case-insensitive). If the name doesn't match, the script refuses to proceed.
- Destructive scripts are **dry-run by default** — they print what they would do and exit 0. Pass `--apply` to actually run.
- Deletes require typed confirmation: the operator must type the literal string `DELETE-CONFIRM` at the prompt.
- Every operation is appended to `audit.log` as a JSON line with timestamp and details.

## Required environment

Create `.env.local` at the repo root with:

```
VAPI_API_KEY=vapi_sk_...
VAPI_ASSISTANT_ID=asst_...
VAPI_WEBHOOK_SECRET=some-shared-secret
PUBLIC_BACKEND_URL=https://your-ngrok-or-prod.example.com/vapi/webhook
```

`VAPI_API_KEY` is the secret API key from the Vapi dashboard.
`VAPI_ASSISTANT_ID` is the existing JOOLA assistant ID. After `vapi:recreate:apply`, you must update this to the **new** assistant ID printed at the end of the run.

## Commands

All commands assume PowerShell and that you `pnpm install` once.

### Inspect (safe, read-only)

```powershell
pnpm --filter @joola/vapi-setup vapi:inspect
```

Prints the current assistant's name, model, voice, tool count, webhook URL, and first message. Appends an `inspect` entry to `audit.log`. Use this any time to verify what's deployed.

### Recreate (destructive — Option B lifecycle)

Dry-run (prints what would happen, **does not** delete or create):

```powershell
pnpm --filter @joola/vapi-setup vapi:recreate
```

Apply (asks for typed `DELETE-CONFIRM`, then deletes the existing assistant and creates a fresh one with the full config):

```powershell
pnpm --filter @joola/vapi-setup vapi:recreate:apply
```

At the end, the new assistant ID is printed. **You must update `VAPI_ASSISTANT_ID` in `.env.local`** before any subsequent scripts will work.

### Update webhook URL only

Use when your ngrok or prod backend URL changes but the assistant configuration is otherwise good. Dry-run:

```powershell
pnpm --filter @joola/vapi-setup vapi:update-webhook
```

Apply:

```powershell
pnpm --filter @joola/vapi-setup vapi:update-webhook:apply
```

## Audit log

Every script appends a JSON line to `apps/vapi-setup/audit.log`. Format:

```
{"iso_ts":"2026-05-17T14:09:00.000Z","action":"recreate","details":{"old_id":"asst_old","new_id":"asst_new","name":"JOOLA CS Warranty Assistant"}}
```

The file is append-only — do not edit it manually.

## What this package does NOT do

- Does not list, modify, or read other Vapi assistants in the org.
- Does not install npm packages (this README is the one place that mentions `pnpm install`).
- Does not change the policy version. Policy updates happen in `packages/vapi-assistant-config/system-prompt.md` first.
- Does not call Vapi during typecheck. `pnpm --filter @joola/vapi-setup typecheck` is offline-safe.

## Troubleshooting

| Error | Fix |
|---|---|
| `Missing env: VAPI_API_KEY` | Create `.env.local` at repo root. |
| `Assistant name 'XYZ' does not contain 'joola' — refusing to proceed` | The `VAPI_ASSISTANT_ID` points to a non-JOOLA assistant. Double-check the env var. |
| `Confirmation did not match` | You must type the literal string `DELETE-CONFIRM` (uppercase, with hyphen). |
| `Vapi 401` | API key is invalid or expired. |
| `Vapi 404` | The assistant ID no longer exists. Run `vapi:recreate:apply` to provision a fresh one. |
