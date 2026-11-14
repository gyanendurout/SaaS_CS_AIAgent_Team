# Shopify Catalogue (Storefront) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Live product lookups (price, sale price, stock per variant, link) from the JOOLA Shopify store for every channel, starting with the voice agent — off by default.

**Architecture:** `apps/ai-agents/app/catalog/` holds a small Storefront GraphQL client (patterns ported from the Shopify chatbot: transient-error retry, product mapping, test/GovX exclusion, title de-dupe) and a gated service. The voice path mirrors `search_knowledge`: Vapi → API `/api/tools/search_products` → ai-agents `/tools/search_products`. Gate: `CATALOG_SOURCE=off|shopify` (default `off`, typos fall back to `off`).

**Tech Stack:** Python / httpx / FastAPI · Fastify + zod · Shopify Storefront GraphQL `2026-07` · credentials reused from the chatbot (`SHOPIFY_STORE`, `SHOPIFY_STOREFRONT_TOKEN`).

## Decisions

| Decision | Chosen | Alternatives | Why |
|---|---|---|---|
| Lookup strategy | Storefront `products(query:)` with `title:<word>*` AND-ed per keyword | Free-text search; full catalogue + local ranking (chatbot) | Probe: free-text ranks badly ("pro v" → TT nets); full catalogue = 2.1 s per cold start on Vercel (512 products). Title-AND search was precise and 0.3–0.45 s |
| Credentials | Reuse chatbot's Storefront token | New token | User decision; read-only, storefront tokens are low-privilege |
| Voice numerals | "pro 5/five/4/four" → "pro v/iv" | none | Speech-to-text writes numbers, titles use roman numerals |
| Caching | 5-min per-query in-process cache | none / Supabase | Warm instances skip Shopify; cold starts still fast |
| Timeouts | 4 s per request, 2 attempts | chatbot's 30 s / 3 attempts | Live calls cannot wait; API side caps the tool at 5 s |
| Writes | none (read-only) | — | Scope |

## Tasks

1. Config: `catalog_source` (lenient), `shopify_store`, `shopify_storefront_token`, `shopify_api_version` — tests first.
2. `app/catalog/storefront.py`: `extract_keywords`, `title_query`, `map_product`, `StorefrontClient.search` (retry on transient, exclusion, de-dupe) — tests with `httpx.MockTransport`.
3. `app/catalog/service.py`: `search_products()` gate + cache; disabled when off or creds missing; never raises.
4. ai-agents `POST /tools/search_products`.
5. API: client method (5 s timeout), `/api/tools/search_products` (degrades to `enabled:false`), register, `TOOL_PATHS`.
6. Vapi: `tools/search_products.json`, prompt row; add to live assistant with `vapi:add-tool` (approval).
7. Verify: tests, typecheck, live read-only probe, runbook section.

## Rollback
`CATALOG_SOURCE=off` → identical to today. Remove the Vapi tool via the add-tool backup. Revert branch.
