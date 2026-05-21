# @joola/vapi-assistant-config

Static configuration assets for the JOOLA CS Warranty Vapi voice assistant. This package contains **no code** — only the markdown prompts, JSON schemas, and template payloads that the `@joola/vapi-setup` scripts read at runtime to provision the assistant in the Vapi platform.

## Why a separate package?

Vapi assistant config is a slow-moving artifact tied to the policy version (`1.0.0`). Keeping it in its own package means:

- Policy editors / CS leads can review changes without touching application code.
- The setup scripts (`apps/vapi-setup`) have one canonical source — no copy/paste of prompts into TS strings.
- Future agents (intake normalizer, claim summary, customer reply) can re-use the persona / KB excerpts.

## Contents

| File | Purpose |
|---|---|
| `system-prompt.md` | Full instruction set Vapi loads as `model.systemPrompt`. Includes persona, built-in policy knowledge, tool-calling rules, voice scripts, tone rules, and conversation flow. Substituted into `assistant.json` at script runtime. |
| `knowledge-base.md` | Curated subset of `docs/policies/cs-knowledge-base-v1.md` that Vapi can answer **without** calling our backend. Kept in sync with the master policy. |
| `assistant.json` | Vapi `POST /assistant` body **template**. Contains four placeholders the setup scripts must substitute: `__SYSTEM_PROMPT__`, `__TOOLS__`, `__WEBHOOK_URL__`, `__WEBHOOK_SECRET__`. |
| `tools/*.json` | One file per Vapi tool — each is an OpenAI function-calling schema. Each tool corresponds to a Fastify endpoint on our backend that returns DB-grounded JSON. |

## Tools

| Tool | When Vapi calls it | Backend returns |
|---|---|---|
| `lookup_order` | Customer mentions order number or product | order row + source + product_type + customer info |
| `check_warranty_registration` | Customer claims NFC registration | registered? within 14-day window? receipt approved? |
| `evaluate_eligibility` | All claim facts gathered, need decision | decision + reason_code + citation |
| `create_claim` | Customer wants a claim filed | claim_id (`WC-XXXXX`) + status_detail |
| `escalate_to_human` | Case fits escalation criteria (§5.2) | escalation row created in queue |

## How the setup scripts consume this package

`apps/vapi-setup/src/recreate.ts` does roughly:

1. Read `system-prompt.md` -> string.
2. Read every `tools/*.json` -> array of function schemas.
3. Read `assistant.json` -> template string.
4. Replace placeholders with the loaded prompt, tools, and env-driven webhook URL/secret.
5. POST the resulting JSON to Vapi `/assistant`.

## Editing rules

- **Never** edit `assistant.json` to remove the four `__PLACEHOLDER__` tokens — the setup scripts depend on them.
- When updating the persona or tone, update `system-prompt.md` **and** bump the audit log via a fresh `vapi:recreate:apply` run.
- Tool schema changes must be coordinated with the Fastify backend route signatures (`apps/api/src/routes/tools/*.ts` — built by another agent).
