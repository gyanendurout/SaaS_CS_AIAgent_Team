# Full QA + Live Shopify Order Cards — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove every feature on `feat/cs-memory` works end to end (main paths first, then edge
cases and failure modes), and add a "Order status — live Shopify" section to the customer demo
that lists real Team JOOLA sandbox orders.

**Architecture:** QA is layered: offline unit suites → local services → production (read-only)
→ signed Vapi webhook → manual voice call. The new demo section is a thin read path:
customer-demo (browser) → API `GET /api/customer/live_orders` → ai-agents
`/tools/live_orders` (`X-Internal-Secret`) → Shopify Admin (same `JOOLA CS Agent` app).
Emails are masked unless their domain is on `ORDER_SAMPLE_EMAIL_DOMAINS`; postcodes are never sent.

**Tech Stack:** FastAPI + httpx + pytest (ai-agents), Fastify + zod + tsc (api), Next.js 14
client components (customer-demo), Vapi, Vercel, Supabase (production — read-only in QA),
Shopify Admin + Storefront APIs (Team JOOLA sandbox only).

**Owner decisions this plan relies on (2026-11-14):**
- Shopify = Team JOOLA sandbox only (also for production Vercel/Vapi).
- Demo site is public ("anyone with the link") → **full emails are NOT shown publicly**; only
  domains on the allowlist are shown in full. (Owner asked for full emails; declined for privacy,
  alternative agreed in chat.)
- Warranty scenario cards stay on seeded Supabase data (policy engine reads Supabase).

**Safety rules for every QA task**
- Production Supabase `isrcdvhtfnbzlnvhgule`: read-only. Anything that creates claims/drafts
  (create_claim, email/web inbound, end-of-call) only with the owner's OK, obviously fake data,
  and cleanup via `scripts/cleanup-test-data.mjs`.
- Never print secrets or customer personal data in output/logs/reports; report counts,
  statuses and booleans ("email readable: true"), never values.
- Vapi / Vercel / git push changes need the owner's explicit OK.

---

## Part A — New feature: live order cards

### Task A1: `list_recent_orders` in the Admin client (ai-agents)

**Files:**
- Modify: `apps/ai-agents/app/orders/admin.py`
- Test: `apps/ai-agents/app/tests/test_orders.py`

**Step 1: Write failing tests**

```python
def test_mask_email() -> None:
    from app.orders.admin import mask_email
    assert mask_email("pat.smith@gmail.com", allow=frozenset()) == "p***@g***.com"
    assert mask_email("qa@joola.com", allow=frozenset({"joola.com"})) == "qa@joola.com"
    assert mask_email("QA@Joola.COM", allow=frozenset({"joola.com"})) == "QA@Joola.COM"
    assert mask_email(None, allow=frozenset()) is None
    assert mask_email("not-an-email", allow=frozenset()) is None
    assert mask_email("a@b", allow=frozenset()) == "a***@b***"


async def test_list_recent_orders_maps_and_masks() -> None:
    fake = _Shopify(orders=[_order(name="#5301"), _order(name="#5300", email="qa@joola.com")])
    rows = await _client(fake).list_recent_orders(limit=2, allow=frozenset({"joola.com"}))
    assert [r["order_number"] for r in rows] == ["#5301", "#5300"]
    assert rows[0]["email_hint"] == "p***@e***.test"
    assert rows[1]["email_hint"] == "qa@joola.com"
    assert "20852" not in json.dumps(rows)          # postcodes never leave
    assert rows[0]["fulfillment_status"] == "FULFILLED"
```

Extend `_Shopify.__call__` so a `variables` dict without `q` (the list query) returns the same
`orders.nodes`; assert the list query asks for `sortKey: CREATED_AT, reverse: true`.

**Step 2:** `cd apps/ai-agents && .venv/Scripts/python -m pytest -q app/tests/test_orders.py -k "mask or list_recent"` → FAIL (ImportError).

**Step 3: Implement** in `admin.py`:
- `LIST_QUERY` — `orders(first: $first, sortKey: CREATED_AT, reverse: true)` with the same node
  fields as `ORDER_QUERY` (email needed for the hint; addresses not requested).
- `mask_email(email, *, allow)` — `None` for empty/invalid; full email if domain (lower-case) in
  `allow`; else first char of local part + `***@` + first char of domain label + `***` + `.tld`.
- `AdminClient.list_recent_orders(limit, allow)` → `[{**map_order(n), "email_hint": mask_email(...)}]`,
  `limit` clamped 1..20, same deadline/retry path (`_graphql` takes the query as a parameter).

**Step 4:** run the two tests → PASS; full suite → all pass.

**Step 5:** `git commit -m "feat: list recent sandbox orders with masked email hints"`

### Task A2: service + route `/tools/live_orders` (ai-agents)

**Files:**
- Modify: `apps/ai-agents/app/config.py` (add `order_sample_email_domains: str = ""`, comma list)
- Modify: `apps/ai-agents/app/orders/service.py`, `apps/ai-agents/app/routes/tools.py`
- Test: `apps/ai-agents/app/tests/test_orders.py`

**Tests first:** disabled → `{"enabled": false, "orders": []}`; enabled → list; Shopify down →
`{"enabled": true, "orders": [], "error": "unavailable"}`; 60 s in-process cache (second call does
not hit Shopify; `reset_client()` clears it); route requires `X-Internal-Secret` when set; route
`limit` validation (0 and 21 → 422).

**Implement:** `list_live_orders(limit=10)` in `service.py` (never raises, caches 60 s keyed by
limit), `POST /tools/live_orders` with `dependencies=[Depends(require_internal_secret)]`.

Run suite → pass. Commit `feat: live_orders endpoint for demo order cards`.

### Task A3: API proxy `GET /api/customer/live_orders` (api)

**Files:**
- Create: `apps/api/src/routes/customer/live-orders.ts`
- Modify: `apps/api/src/plugins/ai-agents.ts` (`listLiveOrders(limit)`), `apps/api/src/index.ts`

Copy `routes/tools/get-order-status.ts`: zod `limit` query (1..20, default 10), on
`UpstreamError` → `{enabled:false, orders:[], error:'upstream_unavailable'}`, log counts only.
Check CORS: the demo origin must already be allowed for `/api/customer/*` (see how
`web-inbound` is called from the demo); reuse that.

Verify: `cd apps/api && npx tsc --noEmit` clean. Commit `feat: API route for live demo orders`.

### Task A4: Demo UI section (customer-demo)

**Files:**
- Create: `apps/customer-demo/src/components/LiveOrders.tsx`
- Create: `apps/customer-demo/src/lib/api/live-orders.ts`
- Modify: `apps/customer-demo/src/app/call/page.tsx` (render under `ScenarioHints`), and the
  web page if order questions are supported there.

Card per order: order number (copy button), date, payment + fulfilment status chip, items,
carrier + tracking link, returns, email hint ("say this email" only when unmasked; otherwise
"use your own order or a staff test order"). States: loading skeleton, `enabled:false` ("Live
orders are switched off"), error ("Couldn't load live orders"), empty. Refresh button. No
postcode anywhere. Load `ui-ux-pro-max` before styling; match `ScenarioHints` look.

Verify: `npx tsc --noEmit` + `pnpm build` in `apps/customer-demo`; open `http://localhost:3003/call`
and check all four states (switch `ORDER_SOURCE` off, stop ai-agents, normal). Commit
`feat: live Shopify order cards on demo`.

---

## Part B — QA of every feature (main paths first)

Record every result in `docs/qa/2026-11-14-full-qa.md` (table per area: case, method,
expected, actual, pass/fail; defects with ID, severity, root cause, fix, regression test).

### Task B1: Baseline — automated suites
- `cd apps/ai-agents && .venv/Scripts/python -m pytest -q --cov=app --cov-report=term-missing` → all pass, coverage ≥ 80 % (record new-module %).
- `cd packages/warranty-policy && pytest -q` → 90 pass (unchanged).
- `npx tsc --noEmit` in `apps/api`, `apps/dashboard`, `apps/customer-demo`, `apps/vapi-setup` → clean.
- `ruff check apps/ai-agents/app` → clean.

### Task B2: Production health + configuration (read-only)
- `GET https://joola-cs-ai-agents.vercel.app/health` → `knowledge_source=vector`, `catalog_enabled=true`, `internal_auth=true`.
- Add `orders_enabled` to `/health` (TDD, mirrors `catalog_enabled`) so the switch is visible.
- Direct ai-agents tool calls without secret → 401 for all three live tools.
- Shopify: Storefront shop name = Team JOOLA; Admin token scope = exactly the 5 read scopes.
- Vapi assistant read-back (`pnpm vapi:inspect` or GET): serverUrl, tool list, brand replacements, keyterm, prompt note.

### Task B3: Knowledge memory (`search_knowledge`) — via production API
Main: 10 real customer questions (warranty length, Vietnam shipping, returns window, NFC
registration, edge guard, …) → relevant top hit. Edge: empty / 1 char / 1000 chars / emoji /
another language / prompt-injection text / off-topic ("weather") → no crash, sensible
`results`. Brand: "Julia warranty" == "JOOLA warranty" top hit.

### Task B4: Live catalogue (`search_products`)
Main: 10 named products (Perseus, Kosmos Pro V, iPong, paddle cover, net) → price, stock,
URL. Edge: misspellings, "pro 3" vs "pro iii", closest-match flag, a product that doesn't exist,
Shopify-query syntax injection (`title:*`, quotes, `OR`), 20 concurrent.

### Task B5: Order status (`get_order_status`) — production API, real sandbox orders
Main (email read in memory, never printed): newest order + right email → ok; tracked order →
carrier + link; old order (#1001) → ok (read_all_orders); order with a return (find one) →
returns listed; cancelled order (find one) → `cancelled:true`; postcode path incl. ZIP+4 and
spaces. Edge: wrong email → not_found; nonexistent number → not_found (identical body);
"#", "JL-", spaces, words; 2 digits / 11 digits → invalid; email with spaces/case;
no details → needs_verification; 6 wrong tries → too_many_attempts (note: per instance);
Shopify-syntax injection in order_number (`5301 OR name:*`) → digits only, no leak;
very long email → 400/422; latency p50 warm.

### Task B6: Vapi webhook path (signed)
Signed `tool-calls` for each of the 3 live tools + `lookup_order` → correct `results`; both
argument formats; unknown tool; forged signature → 401; parallel tool calls in one message.
(Only after the owner applies `get_order_status` to Vapi.)

### Task B7: Brand voice + normalisation
Unit: `test_brand.py` passes. Live: read back `voice.chunkPlan.formatPlan.replacements`
and `transcriber.keyterm`. Manual: greeting says "YOO-la" (owner's test call).

### Task B8: Failure modes
ai-agents unreachable (local API pointed at dead port) → each tool degrades within 5.5 s;
bad Shopify Admin secret (local env) → `unavailable`, no secret in logs; ORDER_SOURCE typo →
off with warning; CATALOG_SOURCE=off / KNOWLEDGE_SOURCE=static → original behaviour.

### Task B9: Load
20 and 50 concurrent `get_order_status` (mixed right/wrong) and `live_orders` via production
API → no 5xx, p95 recorded, Shopify throttling handled (retry) — stop at the first 429 storm.

### Task B10: Existing warranty flows still work (regression)
`lookup_order`, `check_warranty_registration`, `evaluate_eligibility` with seeded orders
(JD-100001 eligible, EB-300001 not eligible, JD-099001 expired) via production API → same
decisions as the scenario cards. No claim creation unless the owner approves.

### Task B11: Manual voice script (owner)
12-question call script covering greeting pronunciation, knowledge, product, order status
(real sandbox order with an allowlisted email), wrong-email refusal, warranty scenario,
escalation. Owner runs it; results added to the QA report.

### Task B12: Report, docs, memory
Write the QA report; update `docs/PROJECT_STATUS.md` (§3, §4, Last updated),
`docs/CS_MEMORY_RUNBOOK.md` (live order cards + `ORDER_SAMPLE_EMAIL_DOMAINS`), `graphify update .`.
Commit `docs: full QA report`. Push + Vercel env (`ORDER_SAMPLE_EMAIL_DOMAINS`) + Vapi tool
only with the owner's OK.

---

## Inputs needed from the owner
1. Email domains (or exact addresses) of staff/test accounts that may be shown in full on the
   demo, e.g. `joola.com`. Without it every email is masked.
2. OK to apply the Vapi tool `get_order_status` (blocked by the safety check earlier).
3. Whether QA may create clearly-fake claims in production Supabase (then cleaned up) to test
   the claim/email/web flows end to end; otherwise those stay read-only.
