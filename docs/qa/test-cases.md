# JOOLA AI CS — Manual Test Cases

Hand-runnable curl-based regression suite. Each block is copy-paste-able from
a Git Bash shell on Windows (or any POSIX shell). Replace the secrets at the
top with values from `.env.local` before running.

> **Last validated:** 2026-05-18 against commit on `main`. Updated alongside
> the 7-bug fix described in `BUG_FIXES.md` / git log.

---

## 0. Prerequisites

### 0.1 Services must be running

| Service | URL | Started by |
|---|---|---|
| Fastify API | http://localhost:3001 | `pnpm -C apps/api dev` |
| Python ai-agents | http://localhost:8000 | `apps/ai-agents/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` |
| Dashboard | http://localhost:3000 | `pnpm -C apps/dashboard dev` |
| Customer demo | http://localhost:3003 | `pnpm -C apps/customer-demo dev` |
| ngrok tunnel (Vapi only) | https://uncoated-oxymoron-written.ngrok-free.dev → :3001 | `ngrok http --domain=uncoated-oxymoron-written.ngrok-free.dev 3001` |

Smoke check all four in one line:

```bash
curl -s -o /dev/null -w "api:%{http_code} ai:%{http_code} dash:%{http_code} cust:%{http_code}\n" \
  http://localhost:3001/health http://localhost:8000/health http://localhost:3000/live http://localhost:3003/email
# Expect: api:200 ai:200 dash:200 cust:200
```

### 0.2 Shell variables (load once per session)

```bash
export API=http://localhost:3001
export AI=http://localhost:8000
export SB=https://isrcdvhtfnbzlnvhgule.supabase.co
export SB_KEY=$(grep -E "^SUPABASE_SECRET_KEY=" /c/Workspace/SaaS_CS_AIAgent_Team/.env.local | cut -d= -f2)
export VAPI_SECRET=$(grep -E "^VAPI_WEBHOOK_SECRET=" /c/Workspace/SaaS_CS_AIAgent_Team/.env.local | cut -d= -f2)
```

> Note: every curl POST should use `--data-raw` (not `-d`) when the payload
> contains non-ASCII characters like `§`, `—`, or `é`. With `-d` curl computes
> Content-Length from the shell-mangled bytes and Fastify returns
> `FST_ERR_CTP_INVALID_CONTENT_LENGTH 400`.

### 0.3 Seed data reference

| UUID prefix | Source |
|---|---|
| `11111111-1111-1111-1111-0000000000XX` | customers (1–33) |
| `22222222-2222-2222-2222-0000000000XX` | orders (1–60+) |

Key customers:

| ID | Name | Email | Country | Why useful |
|---|---|---|---|---|
| `…000000000001` | John Smith | john.smith@example.com | US | Has multiple paddle orders, full NFC registration |
| `…000000000002` | Sarah Lee | sarah.lee@example.com | US | NFC Hyperion order JD-100002 |
| `…000000000018` | Marcus Hall | marcus.hall@example.com | US | Has eBay order EB-300002 (unauthorized) |
| `…000000000030` | Ravi Kumar | ravi.kumar@example.in | IN | Outside-region for §4.13 testing |

Key orders:

| Order # | Product | Source | Registration |
|---|---|---|---|
| `JD-100001` | Perseus 3 14mm | JOOLA_DIRECT | NFC registered + receipt approved |
| `JD-100002` | Hyperion CFS 16mm | JOOLA_DIRECT | NFC registered + receipt approved |
| `JD-100016` | Journey Paddle | JOOLA_DIRECT | Not registered (standard 6-mo only) |
| `EB-300001` | Hyperion CFS 16mm | EBAY | Unauthorized seller — should NOT_ELIGIBLE |
| `JD-099001` | Hyperion Original | JOOLA_DIRECT | Purchased 2024-11-02 → warranty expired |
| `JD-100040` | Perseus 3 16mm | JOOLA_DIRECT | Owner is in India → OUTSIDE_REGION |

---

## 1. Smoke tests

### 1.1 Liveness probes

```bash
curl -s $API/health        # → {"status":"ok","version":"0.1.0","time":"..."}
curl -s $AI/health         # → {"status":"ok","service":"joola-ai-agents","version":"0.1.0"}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/live       # → 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/call       # → 200
```

### 1.2 404 handling

```bash
curl -s $API/api/does-not-exist
# Expect: {"error":"not_found","message":"GET /api/does-not-exist is not a route"}
```

---

## 2. Customer channel endpoints

### 2.1 POST /api/customer/voice/start

```bash
# By customer_id (frontend default)
curl -s -X POST $API/api/customer/voice/start \
  -H "content-type: application/json" \
  --data-raw '{"customer_id":"11111111-1111-1111-1111-000000000001"}'
# → {"claim_id":"WC-XXXXX","customer_id":"11111111-..."}

# By email (auto-creates customer if missing)
curl -s -X POST $API/api/customer/voice/start \
  -H "content-type: application/json" \
  --data-raw '{"customer_email":"john.smith@example.com"}'

# Negative: neither id nor email
curl -s -X POST $API/api/customer/voice/start \
  -H "content-type: application/json" --data-raw '{}'
# → 400 invalid_input "Provide customer_id or customer_email"
```

### 2.2 POST /api/customer/email/inbound

```bash
# Frontend-shape payload (from_addr / to_addr / customer_id)
curl -s -X POST $API/api/customer/email/inbound \
  -H "content-type: application/json" \
  --data-raw '{
    "from_addr":"sarah.lee@example.com",
    "to_addr":"support@joola.com",
    "subject":"My Hyperion cracked",
    "body":"Hi team, my JOOLA Hyperion CFS 16mm paddle cracked along the edge guard. Order JD-100002.",
    "customer_id":"11111111-1111-1111-1111-000000000002"
  }'
# → {"claim_id":"WC-XXXXX","status":"received"}
# After ~3s the claim should be DRAFT_PENDING_APPROVAL with a draft that
# references the specific issue (cracked + edge guard + Hyperion).
```

### 2.3 POST /api/customer/web/inbound

```bash
# Default frontend submission (urgency=normal)
curl -s -X POST $API/api/customer/web/inbound \
  -H "content-type: application/json" \
  --data-raw '{
    "customer_id":"11111111-1111-1111-1111-000000000001",
    "order_number":"JD-100001",
    "product":"Pickleball Paddle NFC",
    "issue":"My paddle cracked along the edge during normal play.",
    "urgency":"normal"
  }'

# Urgent path
curl -s -X POST $API/api/customer/web/inbound \
  -H "content-type: application/json" \
  --data-raw '{
    "customer_id":"11111111-1111-1111-1111-000000000001",
    "order_number":"JD-100001",
    "issue":"Tournament tomorrow, handle just snapped",
    "urgency":"urgent"
  }'

# Negative: urgency outside enum (regression for BUG-002)
curl -s -X POST $API/api/customer/web/inbound \
  -H "content-type: application/json" \
  --data-raw '{
    "customer_id":"11111111-1111-1111-1111-000000000001",
    "issue":"test","urgency":"med"
  }'
# → 400 invalid_input "Expected 'low' | 'normal' | 'high' | 'urgent', received 'med'"
```

---

## 3. Vapi tool endpoints (`/api/tools/*`)

These mirror exactly what Vapi POSTs from the assistant function-call dispatcher.

### 3.1 lookup_order

```bash
# By exact order number
curl -s -X POST $API/api/tools/lookup_order \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"JD-100001"}'
# → {"found":true,"order":{...},"customer":{...},"registration":{...}}

# Spoken digits — fuzzy fallback
curl -s -X POST $API/api/tools/lookup_order \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"100002"}'
# → matches JD-100002

# By customer email — returns most recent order
curl -s -X POST $API/api/tools/lookup_order \
  -H "content-type: application/json" \
  --data-raw '{"customer_email":"john.smith@example.com"}'

# Miss — structured shape (regression for BUG-006)
curl -s -X POST $API/api/tools/lookup_order \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"ZZ-999999"}'
# → {"found":false,"order":null,"customer":null,"registration":null}

# Negative
curl -s -X POST $API/api/tools/lookup_order \
  -H "content-type: application/json" --data-raw '{}'
# → 400 "Provide order_number or customer_email"
```

### 3.2 check_warranty_registration

```bash
# Registered order
curl -s -X POST $API/api/tools/check_warranty_registration \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"JD-100001"}'
# → {"registered":true,"nfc_id":"NFC-4421","within_window":true,...}

# Unregistered order
curl -s -X POST $API/api/tools/check_warranty_registration \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"JD-100016"}'
# → {"registered":false,...,"order_id":"..."}

# By NFC chip id
curl -s -X POST $API/api/tools/check_warranty_registration \
  -H "content-type: application/json" \
  --data-raw '{"nfc_id":"NFC-4421"}'
```

### 3.3 evaluate_eligibility — BRD §18 policy scenarios

> **Critical**: these 6 cases are the policy-acceptance gate in BRD §25.2.

```bash
# §18.1 NFC eligible (12-month warranty)
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"JD-100001","product_type":"PADDLE_NFC","issue":"Cracked","is_defective":true,"is_original_purchaser":true}'
# → decision=ELIGIBLE_FOR_DAMAGE_REVIEW, reason_code=NFC_EXTENDED_WARRANTY, citation=§2.5

# §18.4 Unauthorized seller (eBay)
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"product_type":"PADDLE_NFC","order_source":"EBAY","purchase_date":"2026-04-01","issue":"Cracked","is_defective":true,"is_original_purchaser":true,"country":"US","nfc_registered":false,"replacements_used":0}'
# → decision=NOT_ELIGIBLE, reason_code=UNAUTHORIZED_SELLER, citation=§1.7, §2.3, §4.8

# §18.5 Outside US/Canada
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"product_type":"PADDLE_NFC","order_source":"JOOLA_DIRECT","purchase_date":"2026-04-01","issue":"Cracked","is_defective":true,"is_original_purchaser":true,"country":"OTHER","nfc_registered":false,"replacements_used":0}'
# → decision=NOT_ELIGIBLE, reason_code=OUTSIDE_REGION, citation=§2.1, §4.13

# Warranty expired
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"product_type":"PADDLE_STANDARD","order_source":"JOOLA_DIRECT","purchase_date":"2024-10-01","issue":"Cracked","is_defective":true,"is_original_purchaser":true,"country":"US","nfc_registered":false,"replacements_used":0}'
# → decision=WARRANTY_EXPIRED, reason_code=PAST_WARRANTY_WINDOW, citation=§2.4

# §18.6 Replacement limit reached
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"product_type":"PADDLE_NFC","order_source":"JOOLA_DIRECT","purchase_date":"2026-04-01","issue":"Cracked","is_defective":true,"is_original_purchaser":true,"country":"US","nfc_registered":true,"replacements_used":3}'
# → decision=HUMAN_REVIEW_REQUIRED, reason_code=REPLACEMENT_LIMIT_REACHED, citation=§2.8, §5.2

# §18.7 No-warranty product (pickleballs)
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"product_type":"PICKLEBALL_BALLS","order_source":"JOOLA_DIRECT","purchase_date":"2026-04-01","issue":"Dead","is_defective":true,"is_original_purchaser":true,"country":"US"}'
# → decision=NOT_ELIGIBLE, reason_code=NO_WARRANTY_PRODUCT, citation=§2.4

# DB enrichment (regression for BUG-001 transform layer): omit purchase_date/source/country,
# pass only order_number — backend should look them up.
curl -s -X POST $API/api/tools/evaluate_eligibility \
  -H "content-type: application/json" \
  --data-raw '{"order_number":"EB-300001","product_type":"PADDLE_NFC","issue":"Cracked","is_defective":true,"is_original_purchaser":true}'
# → decision=NOT_ELIGIBLE, reason_code=UNAUTHORIZED_SELLER (source pulled from DB)
```

### 3.4 create_claim

```bash
# With known customer_email — creates a customer-on-the-fly if not seeded
curl -s -X POST $API/api/tools/create_claim \
  -H "content-type: application/json" \
  --data-raw '{
    "customer_email":"john.smith@example.com",
    "customer_name":"John Smith",
    "order_number":"JD-100001",
    "channel":"voice",
    "issue":"Cracked paddle want warranty",
    "is_defective":true,
    "decision":"ELIGIBLE_FOR_DAMAGE_REVIEW",
    "reason_code":"NFC_EXTENDED_WARRANTY",
    "citation":"2.5"
  }'
# → {"claim_id":"WC-XXXXX","status_detail":"AWAITING_VERIFICATION"}

# Minimum required
curl -s -X POST $API/api/tools/create_claim \
  -H "content-type: application/json" \
  --data-raw '{"customer_email":"sarah.lee@example.com","channel":"voice","issue":"Cracked","is_defective":true}'
# → status_detail=IN_RULE_EVAL (decision defaults to PROCESSING)
```

### 3.5 escalate_to_human

```bash
# Use a real WC-XXXXX from a previous create_claim / web-inbound test
CLAIM=WC-10283
curl -s -X POST $API/api/tools/escalate_to_human \
  -H "content-type: application/json" \
  --data-raw "{\"claim_id\":\"$CLAIM\",\"reason\":\"AMBIGUOUS_DAMAGE\",\"priority\":\"high\",\"summary\":\"Customer says cracked but cannot describe.\"}"
# → {"ok":true,"escalation_id":"WC-10283"}

# Verify stage=esc (regression for BUG-003)
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=stage,status_detail,primary_agent_id" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# → [{"stage":"esc","status_detail":"ESCALATED","primary_agent_id":"esc"}]

# Negative: claim that doesn't exist
curl -s -X POST $API/api/tools/escalate_to_human \
  -H "content-type: application/json" \
  --data-raw '{"claim_id":"WC-99999","reason":"SAFETY","priority":"urgent","summary":"x"}'
# → 404 claim_not_found
```

---

## 4. Case lifecycle endpoints

Pre-condition: have a `WC-XXXXX` claim that is `DRAFT_PENDING_APPROVAL` (created by the email or web pipeline).

### 4.1 approve-draft

```bash
CLAIM=WC-XXXXX  # from /api/customer/email/inbound

# 1. Inspect the pending draft
curl -s "$SB/rest/v1/drafts?claim_id=eq.$CLAIM&select=id,status,voice_text,email_subject,email_body" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"

# 2. Approve as-is
curl -s -X POST $API/api/cases/$CLAIM/approve-draft \
  -H "content-type: application/json" --data-raw '{}'
# → {"ok":true,"claim_id":"WC-XXXXX","draft_id":"..."}

# 3. Verify side effects
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=status_detail,stage,closed_at" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# → status_detail=CLOSED_RESOLVED, stage=closed, closed_at filled

# 4. For email-channel claims, outbound email row was written:
curl -s "$SB/rest/v1/emails?claim_id=eq.$CLAIM&direction=eq.outbound&select=id,from_addr,to_addr,subject" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```

### 4.2 approve-draft with edits

```bash
curl -s -X POST $API/api/cases/$CLAIM/approve-draft \
  -H "content-type: application/json" \
  --data-raw '{
    "edited_email_subject":"Updated subject from CS Lead",
    "edited_email_body":"Hand-tuned message body."
  }'
# Then verify drafts.status='edited' and the outbound email uses the new text.
```

### 4.3 reopen

```bash
# Only works after a claim is closed (use one from §4.1)
curl -s -X POST $API/api/cases/$CLAIM/reopen \
  -H "content-type: application/json" \
  --data-raw '{"category":"customer_disputed","note":"Customer says paddle still cracking after our reply."}'
# → {"ok":true,"claim_id":"WC-XXXXX"}

# Verify
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=status_detail,stage,reopened_at,reopen_category,closed_at" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# → status_detail=REOPENED, stage=intake, closed_at=null
```

### 4.4 manual escalate (CS Lead)

```bash
curl -s -X POST $API/api/cases/$CLAIM/escalate \
  -H "content-type: application/json" \
  --data-raw '{"reason":"BRAND_RISK","priority":"urgent","summary":"Customer threatening social-media post"}'

# Verify stage=esc (regression for BUG-007)
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=stage,status_detail,primary_agent_id" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```

---

## 5. Vapi webhook (`POST /webhooks/vapi`)

### 5.1 Signature negative

```bash
curl -s -X POST $API/webhooks/vapi \
  -H "content-type: application/json" \
  --data-raw '{"message":{"type":"status-update","status":"in-progress"}}'
# → 401 {"error":"invalid_signature"}
```

### 5.2 HMAC-signed event

```bash
BODY='{"message":{"type":"status-update","status":"in-progress","call":{"id":"test-1","metadata":{"claim_id":"WC-10095"}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$VAPI_SECRET" -hex | awk '{print $2}')
curl -s -X POST $API/webhooks/vapi \
  -H "content-type: application/json" \
  -H "x-vapi-secret: $SIG" \
  --data-raw "$BODY"
# → {"ok":true}
```

### 5.3 Literal-secret mode (alternative Vapi config)

```bash
curl -s -X POST $API/webhooks/vapi \
  -H "content-type: application/json" \
  -H "x-vapi-secret: $VAPI_SECRET" \
  --data-raw '{"message":{"type":"status-update","status":"in-progress"}}'
# → {"ok":true}
```

### 5.4 Transcript persistence

```bash
CLAIM=WC-10095   # must already exist
BODY=$(printf '{"message":{"type":"transcript","role":"assistant","transcript":"Hi, this is JOOLA support.","transcriptType":"final","call":{"id":"t-1","metadata":{"claim_id":"%s"}}}}' "$CLAIM")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$VAPI_SECRET" -hex | awk '{print $2}')
curl -s -X POST $API/webhooks/vapi -H "content-type: application/json" -H "x-vapi-secret: $SIG" --data-raw "$BODY"

# Verify the line was persisted
curl -s "$SB/rest/v1/transcripts?claim_id=eq.$CLAIM&order=line_index.desc&limit=3&select=line_index,who,txt" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```

---

## 6. Archive export

```bash
# Full export (last 30 days, no filters)
curl -s -o archive.csv -w "status=%{http_code} bytes=%{size_download}\n" \
  "$API/api/archive/export.csv?range=30"
head -3 archive.csv

# Filtered: email channel, last 7 days
curl -s -o email.csv -w "status=%{http_code} bytes=%{size_download}\n" \
  "$API/api/archive/export.csv?range=7&channel=email"

# Filtered: only ESCALATED + escalation flag
curl -s -o esc.csv -w "status=%{http_code} bytes=%{size_download}\n" \
  "$API/api/archive/export.csv?range=30&flag_esc=true"

# Invalid filter
curl -s "$API/api/archive/export.csv?range=30&channel=carrier-pigeon"
# → 400 invalid_query
```

---

## 7. Bug regression tests (the 7 bugs we fixed on 2026-05-18)

Run each block after any code change to confirm the fix hasn't regressed.

### BUG-001 — evaluate_eligibility schema transform

Re-run all 7 commands in §3.3. **Every one must return a non-503 JSON object with `decision` set.** A 503 with `customer_country: missing` or `Input should be an instance of ProductType` means the transform layer or Python `model_validate(strict=False)` broke.

### BUG-002 — web urgency vocabulary

```bash
for u in low normal high urgent; do
  echo -n "$u: "
  curl -s -X POST $API/api/customer/web/inbound -H "content-type: application/json" \
    --data-raw "{\"customer_id\":\"11111111-1111-1111-1111-000000000001\",\"order_number\":\"JD-100001\",\"issue\":\"test\",\"urgency\":\"$u\"}" \
    | grep -oE 'claim_id|error' | head -1
done
# Expect: low,normal,high,urgent → claim_id

# Negative
curl -s -X POST $API/api/customer/web/inbound -H "content-type: application/json" \
  --data-raw '{"customer_id":"11111111-1111-1111-1111-000000000001","issue":"x","urgency":"med"}'
# Expect: 400 with "Expected 'low' | 'normal' | 'high' | 'urgent'"
```

### BUG-003 + BUG-007 — both escalate paths set stage='esc'

```bash
# Make a fresh claim via web
CLAIM=$(curl -s -X POST $API/api/customer/web/inbound -H "content-type: application/json" \
  --data-raw '{"customer_id":"11111111-1111-1111-1111-000000000005","order_number":"JD-100005","issue":"crack","urgency":"normal"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")

sleep 1
# Vapi-tool escalate
curl -s -X POST $API/api/tools/escalate_to_human -H "content-type: application/json" \
  --data-raw "{\"claim_id\":\"$CLAIM\",\"reason\":\"AMBIGUOUS_DAMAGE\",\"priority\":\"high\",\"summary\":\"t\"}"
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=stage" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# Expect: [{"stage":"esc"}]

# CS-lead manual escalate (BUG-007)
CLAIM2=$(curl -s -X POST $API/api/customer/web/inbound -H "content-type: application/json" \
  --data-raw '{"customer_id":"11111111-1111-1111-1111-000000000006","order_number":"JD-100006","issue":"crack","urgency":"normal"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")
sleep 1
curl -s -X POST $API/api/cases/$CLAIM2/escalate -H "content-type: application/json" \
  --data-raw '{"reason":"BRAND_RISK","priority":"urgent","summary":"t"}'
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM2&select=stage" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# Expect: [{"stage":"esc"}]
```

### BUG-004 — pipeline receives raw_input.issue

```bash
RES=$(curl -s -X POST $API/api/customer/web/inbound -H "content-type: application/json" \
  --data-raw '{
    "customer_id":"11111111-1111-1111-1111-000000000007",
    "order_number":"JD-100007",
    "issue":"My JOOLA Agassi Pro IV paddle started buzzing on every hit after only two days. There is a rattling sound near the throat.",
    "urgency":"high"
  }')
CLAIM=$(echo "$RES" | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")
sleep 4
curl -s "$SB/rest/v1/drafts?claim_id=eq.$CLAIM&select=voice_text,email_body" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# PASS: draft text must mention "buzzing" or "rattling" or "Agassi"
# FAIL: draft is generic ("Got it, your paddle is covered under our warranty…")
```

### BUG-005 — voice idempotency

```bash
A=$(curl -s -X POST $API/api/customer/voice/start -H "content-type: application/json" \
    --data-raw '{"customer_id":"11111111-1111-1111-1111-000000000008"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")
B=$(curl -s -X POST $API/api/tools/create_claim -H "content-type: application/json" \
    --data-raw '{"customer_email":"david.park@example.com","channel":"voice","issue":"crack","is_defective":true}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")
[ "$A" = "$B" ] && echo "PASS: $A reused" || echo "FAIL: $A vs $B (duplicate)"
```

### BUG-006 — lookup_order miss shape

```bash
curl -s -X POST $API/api/tools/lookup_order -H "content-type: application/json" \
  --data-raw '{"order_number":"ZZ-999999"}'
# Expect: {"found":false,"order":null,"customer":null,"registration":null}
# FAIL if bare null is returned.
```

---

## 8. UI smoke (manual)

Open in a browser, eyeball the result:

| URL | What to verify |
|---|---|
| http://localhost:3000/live | KPI strip populated, agent team showing all 7 agents, live feed updating as you submit demo events |
| http://localhost:3000/archive | Ticket table loads, decision donut renders, filters apply, CSV export downloads |
| http://localhost:3003/email | Inbox shows the seeded customer; compose form sends without 400; reply lands in inbox within ~5s |
| http://localhost:3003/web | Form submits with all four urgency levels; case status card updates with decision |
| http://localhost:3003/call | "Start Call" button enables once SDK loads; status pill transitions idle → connecting → listening → ended |

---

## 9. End-to-end demo flow (BRD §25.1 acceptance test)

The single best smoke test before any demo.

```bash
# 1. Submit an email claim — full pipeline runs (intake → shopify → warrreg → rules → summary → response)
RES=$(curl -s -X POST $API/api/customer/email/inbound \
  -H "content-type: application/json" \
  --data-raw '{
    "from_addr":"john.smith@example.com",
    "to_addr":"support@joola.com",
    "subject":"Paddle cracked",
    "body":"My JOOLA Perseus paddle from order JD-100001 cracked along the edge today.",
    "customer_id":"11111111-1111-1111-1111-000000000001"
  }')
CLAIM=$(echo "$RES" | python -c "import sys,json;print(json.load(sys.stdin)['claim_id'])")
echo "claim=$CLAIM"

# 2. Wait for pipeline
sleep 5

# 3. Inspect — should be DRAFT_PENDING_APPROVAL with NFC_EXTENDED_WARRANTY
curl -s "$SB/rest/v1/claims?id=eq.$CLAIM&select=channel,decision,reason_code,citation,status_detail,stage,primary_agent_id" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"

# 4. Audit trail — every agent should have written a case_event
curl -s "$SB/rest/v1/case_events?claim_id=eq.$CLAIM&select=ts,actor_id,event&order=ts.asc" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
# Expect events: CUST_EMAIL_RECEIVED, AI_INTAKE_NORMALIZED, AI_ORDER_VERIFIED,
#                AI_REGISTRY_CHECKED, AI_RULE_EVALUATED, AI_SUMMARY_BUILT,
#                AI_DRAFT_GENERATED

# 5. CS-lead approves
curl -s -X POST $API/api/cases/$CLAIM/approve-draft -H "content-type: application/json" --data-raw '{}'

# 6. Customer "sees" the outbound email
curl -s "$SB/rest/v1/emails?claim_id=eq.$CLAIM&direction=eq.outbound&select=subject,body" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```

If all six steps return the expected shapes, the demo is green.

---

## 10. PowerShell adaptations

If you're on PowerShell instead of bash:

```powershell
# Equivalent of the bash header
$API = "http://localhost:3001"
$SB  = "https://isrcdvhtfnbzlnvhgule.supabase.co"
$SB_KEY = (Select-String -Path .env.local -Pattern "^SUPABASE_SECRET_KEY=").Line -replace "^SUPABASE_SECRET_KEY=",""

# POST with JSON body
Invoke-RestMethod -Method Post -Uri "$API/api/customer/voice/start" `
  -ContentType "application/json" `
  -Body '{"customer_id":"11111111-1111-1111-1111-000000000001"}'
```

`Invoke-RestMethod` automatically deserialises JSON responses — no need for `python -c "import json"` indirection.

---

## Change log

| Date | What changed |
|---|---|
| 2026-05-18 | Initial version after 7-bug QA pass (BUG-001…007 verified fixed). |
