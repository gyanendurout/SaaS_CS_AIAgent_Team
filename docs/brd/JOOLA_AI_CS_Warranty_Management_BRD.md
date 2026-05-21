# Business Requirements Document (BRD)
# JOOLA AI Customer Support Warranty Management System

**Project Name:** JOOLA AI Customer Support Warranty Management System  
**Document Type:** Business Requirements Document  
**Version:** 1.0  
**Prepared For:** JOOLA Customer Support / Digital Product / AI Agent Demo Team  
**Prepared By:** Gyanendu Rout / AI Assistant  
**Date:** May 17, 2026  
**Primary Use Case:** Pickleball paddle warranty claim support through AI agents, calls, emails, and CS lead dashboard

---

## 1. Executive Summary

JOOLA needs an AI-powered Customer Support Warranty Management System to support customers who contact the company about broken pickleball paddles, warranty eligibility, NFC registration, receipt verification, and replacement guidance.

The system will connect three major operational areas:

1. **Shopify** — source of truth for customer and purchase/order details.
2. **Warranty Registration System** — source of truth for NFC registration, serial number, receipt upload, registration date, and registration validation.
3. **AI Customer Support Agent Layer** — responsible for handling calls, emails, claim intake, warranty verification, claim summaries, customer responses, agent tracking, and escalation.

The system will also include a **CS Lead Agent Dashboard** that allows a human CS manager or AI CS Lead Agent to monitor all live calls, incoming emails, open tickets, stuck AI agents, warranty decisions, escalations, SLA risks, and claim trends in one place.

The first phase should be a demo-ready version that proves the full concept:

```text
Customer call/email
→ AI understands issue
→ AI checks Shopify purchase
→ AI checks warranty registration system
→ AI applies JOOLA warranty policy
→ AI creates claim summary
→ AI drafts voice/email response
→ CS Lead Dashboard tracks the entire journey
```

This BRD intentionally does **not** define detailed UI styling, because design has already been given to another system. The frontend team should build the CS dashboard by referring to the approved JOOLA-themed CS frontend design/design system.

---

## 2. Business Objectives

### 2.1 Primary Objectives

The system should:

1. Reduce manual work for CS teams handling warranty claims.
2. Provide faster first response to customers.
3. Apply JOOLA warranty policy consistently.
4. Connect Shopify purchase data with separate warranty registration data.
5. Give CS leads real-time visibility into calls, emails, tickets, and AI agent activity.
6. Identify stuck cases and stuck AI agents quickly.
7. Improve governance by creating a clear audit trail for every AI and human action.
8. Prepare a scalable foundation for future AI-powered CS operations.

### 2.2 Demo Objective

The immediate demo should show:

1. A customer call or email arrives.
2. AI creates or updates a claim.
3. AI verifies Shopify purchase details.
4. AI verifies NFC registration details.
5. AI calculates warranty eligibility.
6. AI generates a customer response draft.
7. CS Lead Dashboard shows ticket progress, agent ownership, decision, risk, and next action.

### 2.3 Long-Term Objective

The long-term system should support:

1. Full call handling.
2. Full email intake and response management.
3. Claim lifecycle management.
4. Customer 360 view.
5. AI agent operations monitoring.
6. Escalation management.
7. Warranty trend analytics.
8. Integration with logistics/replacement systems.
9. Continuous improvement through audit and reporting.

---

## 3. Background and Current Problem

Customers may contact JOOLA when their pickleball paddle breaks or appears defective. The current process may require CS agents to manually check multiple systems:

1. Shopify for customer and order details.
2. Warranty registration system for NFC registration and receipt upload.
3. Internal policy documents for warranty rules.
4. Email/call history for customer context.
5. Claim/ticket system for follow-up status.

This creates operational challenges:

1. Slower customer response.
2. Inconsistent warranty interpretation.
3. Manual effort to connect Shopify order data with registration data.
4. Limited real-time visibility into what is happening across calls/emails.
5. Difficulty knowing which AI or human agent is working on which case.
6. Lack of immediate visibility into stuck tickets.
7. Limited management reporting on claim volume, product issues, or escalations.

The proposed system solves this by creating an AI-managed warranty support workflow with a CS Lead Dashboard.

---

## 4. Scope

## 4.1 In Scope — Phase 1 Demo

The first version must include:

1. Backend API for warranty check.
2. Shopify order lookup connector.
3. Warranty registration DB lookup connector.
4. Deterministic warranty rule engine.
5. Claim summary creation.
6. Customer email draft generation.
7. Vapi-friendly voice response endpoint.
8. Mock/demo mode for calls and emails.
9. Simple claim storage using SQLite or similar demo database.
10. CS Lead Dashboard functional screens using the approved frontend design reference.
11. Agent status tracking.
12. Ticket status tracking.
13. Stuck case/stuck agent identification.
14. Basic analytics for demo.
15. Audit log for AI actions.

## 4.2 In Scope — Future Phases

Later versions may include:

1. Real-time Vapi call integration.
2. Real email inbox integration.
3. Real helpdesk/CRM integration.
4. Real claim portal.
5. Damage photo/video AI review.
6. Fraud detection.
7. Replacement order creation.
8. Warehouse/logistics integration.
9. Human approval workflow.
10. Customer self-service portal.
11. Advanced reporting and product quality intelligence.

## 4.3 Out of Scope for Phase 1 Demo

Do not build in phase 1:

1. Real warehouse replacement automation.
2. Real shipping label generation.
3. Real payment/refund processing.
4. Real full fraud detection.
5. Real image damage classification.
6. Full production authentication.
7. Customer-facing login portal.
8. Full multilingual support.
9. Automated live email sending unless explicitly enabled.
10. Writing or modifying Shopify data.
11. Modifying warranty registration records.

---

## 5. Key Stakeholders

| Stakeholder | Role |
|---|---|
| Global CEO / Executive Team | Demo audience and strategic sponsor |
| Customer Support Lead | Primary dashboard user |
| CS Agents | Human operators reviewing escalations |
| Digital Product Team | Product owner and implementation team |
| IT / Engineering Team | Backend, frontend, API, and integration build |
| Warranty Operations Team | Policy and claim process owner |
| Shopify Admin / eCommerce Team | Shopify integration support |
| Warranty Registration System Owner | Registration database access and schema support |
| Legal / Compliance | Warranty policy review and customer communication guardrails |
| Product / Quality Team | Uses claim analytics to identify product issues |

---

## 6. User Personas

## 6.1 Customer

A customer who purchased a paddle and contacts support because:

1. Paddle broke.
2. Paddle cracked.
3. Edge guard separated.
4. Handle broke.
5. Customer wants replacement.
6. Customer wants to know warranty eligibility.
7. Customer registered or did not register through NFC.
8. Customer purchased through JOOLA, authorized retailer, or unauthorized marketplace.

## 6.2 AI Intake Agent

The AI agent that receives customer call/email/form input and starts the claim journey.

## 6.3 Shopify Verification Agent

The AI/tool agent that validates purchase and customer data using Shopify.

## 6.4 Warranty Registration Agent

The AI/tool agent that validates NFC registration, receipt upload, registration date, and serial/NFC details.

## 6.5 Warranty Rule Engine Agent

A deterministic rule-based engine that calculates warranty eligibility. This must not be left to free LLM judgment.

## 6.6 Customer Response Agent

The AI agent that drafts voice responses, email responses, and internal summaries using the rule engine result.

## 6.7 CS Lead Agent

The manager AI agent that monitors all tickets, calls, emails, stuck cases, and AI agent activities. It recommends where human attention is required.

## 6.8 Human CS Lead / Manager

The human manager who uses the dashboard to:

1. Monitor support operations.
2. Review escalations.
3. Approve or edit AI drafts.
4. Reassign cases.
5. Investigate stuck tickets.
6. Track support performance.

---

## 7. Source Systems and Source of Truth

| Data Category | Source of Truth |
|---|---|
| Customer name | Shopify |
| Customer email | Shopify |
| Customer phone | Shopify |
| Customer shipping country/address | Shopify |
| Order number | Shopify |
| Purchase date | Shopify |
| Product/SKU | Shopify |
| Fulfillment status | Shopify |
| NFC ID | Warranty Registration System |
| Serial number | Warranty Registration System |
| Registration date | Warranty Registration System |
| Receipt upload status | Warranty Registration System |
| Receipt approval status | Warranty Registration System |
| Previous replacement count | Claim/Warranty system |
| Claim lifecycle status | New Claim/Ticket system |
| AI decision/audit | AI CS system |
| Email draft/voice response | AI CS system |
| Human approval notes | AI CS system / Helpdesk |

---

## 8. Warranty Policy Requirements

The warranty rule engine must implement the following rules.

## 8.1 General Warranty Eligibility

Warranty is available only when:

1. Customer is the original purchaser.
2. Product was purchased directly from JOOLA or from an authorized retailer.
3. Customer is in the United States or Canada.
4. Product category is warranty eligible.
5. Claim is within the applicable warranty period.
6. Product issue is potentially related to material defect, manufacturing defect, or workmanship.
7. Customer has not exceeded the replacement limit.

Warranty is not available when:

1. Purchase is from unauthorized sellers such as eBay, Facebook Marketplace, auction websites, or unauthorized online sellers.
2. Customer is not the original purchaser.
3. Customer is outside the United States or Canada under the US/Canada warranty policy.
4. Product category has no warranty.
5. Warranty period has expired.
6. Damage is due to normal wear and tear, abuse, improper use, accident, commercial/rental use, unauthorized modification, fading graphics, or similar exclusions.
7. Replacement limit has already been reached.

## 8.2 Pickleball Paddle Warranty

### Standard Paddle Warranty

1. Standard pickleball paddle warranty period is **6 months** from original purchase date.
2. Standard paddle warranty allows a maximum of **2 replacements**.

### NFC Extended Paddle Warranty

A paddle qualifies for **12 months warranty** only if all conditions are met:

1. Paddle is NFC chip-enabled.
2. Paddle was purchased from JOOLA or an authorized retailer.
3. Customer registered through the JOOLA Infinity app or official registration flow.
4. Registration was completed within 14 calendar days of purchase.
5. Receipt was uploaded during registration.
6. Receipt was approved/verified.

If any of the above conditions are missing, late, or invalid:

1. Extended 12-month warranty does not apply.
2. Customer falls under standard 6-month warranty.
3. No exception should be assumed for late registration.

### Replacement Rules

1. Replacement does not restart the warranty.
2. Replacement inherits the remaining warranty from the original purchase date.
3. Replacement should be the same model.
4. If the model is discontinued, comparable model may be offered at JOOLA’s discretion.
5. Upgrades or different model replacements should not be promised by AI.

## 8.3 Product Warranty Map

| Product Category | Warranty Period | Max Replacements |
|---|---:|---:|
| Pickleball Paddle — Standard | 6 months | 2 |
| Pickleball Paddle — NFC Registered | 12 months | 3 |
| Pickleball Nets | 1 year | TBD |
| Pickleball Balls | No warranty | 0 |
| Covers & Cases | No warranty | 0 |
| Bags | 6 months | TBD |
| Eyewear | 1 year | 2 |
| Paddle Sets | No warranty | 0 |

## 8.4 Damage Evidence Requirement

If the warranty is active, the system must not automatically approve replacement in phase 1.

The system should mark the case as:

```text
ELIGIBLE_FOR_DAMAGE_REVIEW
```

Then request:

1. Full front photo of paddle.
2. Full back photo of paddle.
3. Close-up photo of damaged area.
4. NFC/serial area photo if available.
5. Short video if needed.

---

## 9. AI Agent Team Requirements

## 9.1 CS Lead Agent

### Purpose

The CS Lead Agent manages the full support operation.

### Responsibilities

1. Monitor live calls.
2. Monitor incoming emails.
3. Monitor all warranty tickets.
4. Identify stuck tickets.
5. Identify stuck AI agents.
6. Monitor SLA risk.
7. Summarize daily support activity.
8. Recommend human review actions.
9. Identify claim trends by product.
10. Recommend reassignment or escalation.

### Outputs

1. Daily operational summary.
2. Recommended actions.
3. Agent health alerts.
4. SLA risk alerts.
5. Stuck ticket alerts.
6. Product issue trend alerts.

## 9.2 Intake Agent

### Responsibilities

1. Receive customer issue from call/email/form.
2. Identify intent.
3. Capture email/order number/NFC ID/issue description.
4. Create initial interaction record.
5. Route to Shopify Verification Agent.

### Required Inputs

1. Customer email or phone.
2. Order number if available.
3. NFC ID if available.
4. Issue description.
5. Channel: call/email/form.

## 9.3 Shopify Verification Agent

### Responsibilities

1. Search customer by email.
2. Search order by order number.
3. Confirm product purchased.
4. Confirm purchase date.
5. Confirm product SKU/type.
6. Confirm purchase source.
7. Confirm customer country.
8. Return structured Shopify result.

### Restrictions

1. Read-only access.
2. Must not update Shopify.
3. Must not cancel, edit, refund, or modify orders.

## 9.4 Warranty Registration Agent

### Responsibilities

1. Search registration by email/order number/NFC ID/serial.
2. Get registration date.
3. Check receipt uploaded.
4. Check receipt approved.
5. Check NFC chip registration status.
6. Check previous replacement count where available.
7. Return structured registration result.

### Restrictions

1. Read-only access.
2. Must not update registration records.

## 9.5 Warranty Rule Engine Agent

### Responsibilities

1. Apply policy rules deterministically.
2. Calculate warranty period.
3. Calculate warranty expiry.
4. Determine status: active/expired/not eligible.
5. Determine recommendation.
6. Determine if human review required.
7. Return reason and next step.

### Key Rule

LLM must not decide eligibility. The rule engine must decide eligibility.

## 9.6 Customer Response Agent

### Responsibilities

1. Draft short voice response.
2. Draft customer email response.
3. Draft internal CS summary.
4. Use only facts from Shopify, warranty DB, and rule engine.
5. Use empathetic and professional language.
6. Avoid promising replacement before damage review.

## 9.7 Escalation Agent

### Responsibilities

Escalate when:

1. Unauthorized seller dispute.
2. Customer outside US/Canada.
3. Replacement limit reached.
4. Warranty expired but customer is upset.
5. Shopify purchase not found.
6. Product mismatch.
7. NFC registered to different customer.
8. Missing or suspicious receipt.
9. Angry/distressed customer.
10. Legal or social media threat.
11. Low AI confidence.
12. Policy edge case.

---

## 10. Functional Requirements

## 10.1 Call Intake

### Description

The system must accept customer call events from Vapi or mock call simulator.

### Requirements

1. Capture call ID.
2. Capture customer phone number.
3. Capture transcript.
4. Detect intent.
5. Extract email/order number/NFC ID.
6. Create or update ticket.
7. Display call in CS Lead Dashboard immediately.
8. Show current AI agent working on the call.
9. Show call status and sentiment.
10. Generate voice-friendly response.

## 10.2 Email Intake

### Description

The system must accept incoming customer emails or mock email events.

### Requirements

1. Capture email subject.
2. Capture email sender.
3. Capture body.
4. Capture attachments metadata.
5. Classify email intent.
6. Extract customer details.
7. Create or update ticket.
8. Generate email draft.
9. Mark whether human approval is required.

## 10.3 Warranty Check

### Description

The system must verify purchase and registration and calculate warranty decision.

### Requirements

1. Accept email/order number/NFC ID.
2. Query Shopify connector.
3. Query warranty registration connector.
4. Apply warranty rule engine.
5. Return structured decision.
6. Log every step in audit trail.

## 10.4 Claim Creation

### Description

The system must create a claim/ticket record.

### Requirements

1. Generate unique claim ID.
2. Store customer details.
3. Store purchase details.
4. Store registration details.
5. Store warranty result.
6. Store recommendation.
7. Store issue description.
8. Store channel.
9. Store assigned AI agent.
10. Store current ticket status.
11. Store audit events.

## 10.5 Customer Response Drafting

### Description

The system must draft customer responses based on warranty decision.

### Requirements

1. Generate voice response for calls.
2. Generate email draft for emails.
3. Generate internal summary for CS.
4. Use deterministic decision result.
5. Do not override warranty decision.
6. Do not invent missing data.
7. Do not promise replacement before damage review.

## 10.6 Agent Tracking

### Description

The system must track which AI agent is working on which task.

### Requirements

1. Display active tasks per agent.
2. Display completed tasks per agent.
3. Display failed/stuck tasks.
4. Display current ticket assigned to each agent.
5. Display agent status.
6. Display agent health.

## 10.7 Stuck Case Detection

### Description

The system must flag stuck tickets and stuck agents.

### Stuck Reasons

1. Shopify API failure.
2. Warranty DB failure.
3. Missing customer email.
4. Missing order number.
5. NFC mismatch.
6. Receipt missing.
7. Receipt not approved.
8. Product mismatch.
9. Low confidence.
10. Human review required.
11. Ticket stayed in same status too long.
12. Email draft failed.
13. Call transcript incomplete.
14. SLA near breach.

## 10.8 CS Lead Dashboard

### Description

The CS Lead Dashboard must give real-time management visibility.

### Requirements

1. Show total contacts today.
2. Show active calls.
3. Show new emails.
4. Show open warranty claims.
5. Show claims waiting for customer documents.
6. Show claims requiring human review.
7. Show SLA risk.
8. Show agent health.
9. Show live customer activity.
10. Show ticket pipeline.
11. Show ticket detail.
12. Show agent operations.
13. Show escalations.
14. Show analytics.
15. Show audit log.

The frontend must follow the separate JOOLA-themed CS dashboard design specification provided to the design system. This BRD defines functional requirements only and should not override the approved design.

---

## 11. Dashboard Functional Requirements

## 11.1 Command Center

### Purpose

Main operational overview for CS Lead.

### Must Show

1. Total contacts today.
2. Active calls.
3. New emails.
4. Open warranty claims.
5. Eligible for damage review.
6. Waiting for customer documents.
7. Human review required.
8. SLA risk.
9. Average response time.
10. AI auto-handled percentage.
11. Live customer activity.

## 11.2 Live Calls

### Must Show

1. Active calls.
2. Recent calls.
3. Call duration.
4. Transcript preview.
5. Detected intent.
6. Sentiment.
7. Current AI agent.
8. Warranty verification status.
9. Next action.
10. Voice response.

## 11.3 Email Inbox

### Must Show

1. New emails.
2. Emails being processed by AI.
3. Emails waiting for verification.
4. Draft-ready emails.
5. Emails needing human review.
6. Closed emails.
7. Extracted fields.
8. Attachments metadata.
9. Suggested draft.

## 11.4 Warranty Tickets

### Must Show

1. Ticket pipeline by status.
2. Claim ID.
3. Customer.
4. Product.
5. Purchase date.
6. Warranty type.
7. Assigned agent.
8. SLA timer.
9. Risk level.
10. Current status.

## 11.5 Ticket Detail

### Must Show

1. Claim header.
2. Customer details.
3. Shopify purchase details.
4. Warranty registration details.
5. Warranty rule result.
6. Replacement policy.
7. Agent timeline.
8. Call transcript.
9. Email thread.
10. AI draft response.
11. Human notes.
12. Available actions.

## 11.6 Agent Operations

### Must Show

1. Agent list.
2. Agent status.
3. Active tasks.
4. Completed tasks today.
5. Average processing time.
6. Stuck count.
7. Health status.
8. Stuck agent cards.
9. Recommended actions.

## 11.7 Escalations

### Must Show

1. Claim ID.
2. Customer.
3. Escalation reason.
4. Risk level.
5. AI recommendation.
6. Suggested human response.
7. SLA remaining.
8. Action buttons.

## 11.8 Customer 360

### Must Show

1. Customer profile.
2. Shopify orders.
3. Registered products.
4. Warranty claims.
5. Previous replacements.
6. Call history.
7. Email history.
8. Open tickets.
9. Closed tickets.
10. Risk notes.

## 11.9 Claim Analytics

### Must Show

1. Claims by day.
2. Calls vs emails.
3. Claims by product.
4. 6-month vs 12-month claims.
5. Approval/rejection/escalation rate.
6. Average first response time.
7. Average resolution time.
8. Top claim reasons.
9. Top stuck reasons.
10. Unauthorized seller count.
11. Replacement limit cases.
12. Claims by region/retailer.

## 11.10 Knowledge Base

### Must Show

1. Warranty rules.
2. Return rules.
3. Authorized seller rules.
4. Unauthorized seller rules.
5. NFC registration policy.
6. Replacement limits.
7. Email templates.
8. Voice scripts.
9. Escalation rules.
10. FAQ.

## 11.11 Audit Log

### Must Show

1. Time.
2. Ticket ID.
3. Agent.
4. Action.
5. Data source.
6. Result.
7. Confidence.
8. Human override.
9. Before/after values where applicable.

---

## 12. Ticket Status Model

The system must support the following ticket statuses:

```text
NEW_CLAIM
PURCHASE_VERIFICATION_PENDING
PURCHASE_VERIFIED
PURCHASE_NOT_FOUND
REGISTRATION_VERIFICATION_PENDING
REGISTRATION_VERIFIED
REGISTRATION_NOT_FOUND
RECEIPT_VERIFICATION_PENDING
RECEIPT_VERIFIED
DAMAGE_EVIDENCE_REQUIRED
UNDER_WARRANTY_REVIEW
ELIGIBLE_FOR_DAMAGE_REVIEW
NOT_ELIGIBLE
WARRANTY_EXPIRED
HUMAN_REVIEW_REQUIRED
DRAFT_READY
WAITING_FOR_CUSTOMER
APPROVED
REJECTED
WAITING_FOR_RETURN_OR_VOID_BREAK
REPLACEMENT_PROCESSING
REPLACEMENT_SHIPPED
CLOSED
```

---

## 13. Agent Status Model

The system must support these AI agent statuses:

```text
IDLE
WORKING
WAITING_FOR_TOOL
WAITING_FOR_SHOPIFY
WAITING_FOR_WARRANTY_DB
WAITING_FOR_CUSTOMER
WAITING_FOR_HUMAN
FAILED
STUCK
COMPLETED
PAUSED
```

---

## 14. Risk Levels

The system must support the following risk levels:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Risk Examples

| Risk | Example |
|---|---|
| Low | Verified purchase, verified registration, active warranty |
| Medium | Missing receipt or late registration |
| High | Unauthorized seller dispute, angry customer |
| Critical | Legal threat, social media threat, suspected fraud |

---

## 15. Core API Requirements

## 15.1 POST /api/warranty/check

### Purpose

Checks Shopify, warranty registration, and rule engine.

### Input

```json
{
  "email": "demo.approved@example.com",
  "orderNumber": "1001",
  "nfcId": "NFC-1001",
  "issueDescription": "My paddle broke during normal play."
}
```

### Output

```json
{
  "customer": {
    "name": "John Smith",
    "email": "demo.approved@example.com",
    "phone": "+1...",
    "country": "US"
  },
  "shopifyOrder": {
    "found": true,
    "orderId": "gid://shopify/Order/1001",
    "orderNumber": "1001",
    "purchaseDate": "2026-01-10",
    "productName": "JOOLA Perseus Paddle",
    "sku": "J-PERSEUS-001",
    "productType": "pickleball_paddle",
    "purchaseSource": "JOOLA Website",
    "authorizedSeller": true,
    "fulfillmentStatus": "FULFILLED"
  },
  "registration": {
    "found": true,
    "registrationId": "REG-1001",
    "registrationDate": "2026-01-18",
    "nfcId": "NFC-1001",
    "serialNumber": "SER-1001",
    "receiptUploaded": true,
    "receiptApproved": true,
    "nfcChipEnabled": true
  },
  "policyChecks": {
    "originalPurchaser": true,
    "countryEligible": true,
    "authorizedSeller": true,
    "productWarrantyEligible": true,
    "receiptUploaded": true,
    "receiptApproved": true,
    "nfcChipEnabled": true,
    "registeredWithin14Days": true,
    "replacementLimitReached": false
  },
  "warranty": {
    "warrantyType": "12_MONTH",
    "warrantyMonths": 12,
    "warrantyStartDate": "2026-01-10",
    "warrantyExpiryDate": "2027-01-10",
    "claimDate": "2026-05-17",
    "status": "ACTIVE",
    "daysBetweenPurchaseAndRegistration": 8
  },
  "replacementPolicy": {
    "maxReplacements": 3,
    "previousReplacements": 0,
    "remainingReplacements": 3,
    "replacementWarrantyNote": "Replacement inherits the remaining warranty from the original purchase date."
  },
  "recommendation": {
    "decision": "ELIGIBLE_FOR_DAMAGE_REVIEW",
    "reason": "Purchase verified, original purchaser verified, authorized source verified, NFC registration was completed within 14 days, and receipt was uploaded and approved.",
    "nextStep": "Ask customer to upload damage photos and videos."
  }
}
```

## 15.2 POST /api/claims/create

### Purpose

Creates a claim record.

### Input

```json
{
  "email": "demo.approved@example.com",
  "orderNumber": "1001",
  "nfcId": "NFC-1001",
  "issueDescription": "My paddle broke during normal play.",
  "channel": "CALL"
}
```

### Output

```json
{
  "claimId": "WC-10001",
  "status": "CREATED",
  "claimStatus": "ELIGIBLE_FOR_DAMAGE_REVIEW",
  "summary": "Customer purchased JOOLA Perseus Paddle on Jan 10, 2026. Paddle was registered through NFC within 14 days with receipt uploaded and approved. Customer qualifies for 12-month warranty. Claim is active and eligible for damage review."
}
```

## 15.3 POST /api/email/draft

### Purpose

Generates a customer email draft.

### Input

```json
{
  "claimId": "WC-10001"
}
```

### Output

```json
{
  "subject": "Warranty Claim Received – Damage Review Required",
  "body": "Hi John,\n\nThank you for contacting us about your paddle..."
}
```

## 15.4 POST /api/vapi/warranty-check

### Purpose

Returns short voice response for Vapi.

### Input

```json
{
  "email": "demo.approved@example.com",
  "orderNumber": "1001"
}
```

### Output

```json
{
  "message": "I found your purchase and confirmed your paddle was registered within 14 days with a valid receipt. That gives you the 12-month warranty, and it is currently active. The next step is to upload a few damage photos so our team can review the claim."
}
```

## 15.5 GET /api/dashboard/summary

### Purpose

Returns dashboard KPI summary.

### Output

```json
{
  "totalContactsToday": 128,
  "activeCalls": 6,
  "newEmails": 24,
  "openWarrantyClaims": 83,
  "eligibleForDamageReview": 31,
  "waitingForCustomerDocuments": 19,
  "humanReviewRequired": 7,
  "slaRisk": 5,
  "averageFirstResponseTime": "1m 42s",
  "aiAutoHandledPercentage": 64
}
```

## 15.6 GET /api/agents/status

### Purpose

Returns AI agent operations status.

### Output

```json
{
  "agents": [
    {
      "name": "Shopify Verification Agent",
      "status": "WORKING",
      "activeTasks": 2,
      "completedToday": 63,
      "averageTime": "18s",
      "stuckCount": 1,
      "health": "WARNING"
    }
  ]
}
```

## 15.7 GET /api/tickets

### Purpose

Returns warranty tickets.

### Query Filters

1. status
2. agent
3. risk
4. channel
5. date
6. customer
7. product
8. warrantyType

## 15.8 GET /api/tickets/:claimId

### Purpose

Returns full ticket detail.

## 15.9 POST /api/simulate/incoming-call

### Purpose

For demo mode, simulates an incoming customer call.

## 15.10 POST /api/simulate/incoming-email

### Purpose

For demo mode, simulates an incoming customer email.

---

## 16. Database Requirements

## 16.1 claims Table

Fields:

```text
id
claim_id
customer_name
customer_email
customer_phone
country
channel
shopify_order_id
order_number
purchase_date
product_name
sku
product_type
purchase_source
authorized_seller
original_purchaser
registration_id
nfc_id
serial_number
registration_date
receipt_uploaded
receipt_approved
registered_within_14_days
warranty_type
warranty_months
warranty_start_date
warranty_expiry_date
warranty_status
previous_replacements
max_replacements
remaining_replacements
issue_description
recommendation_decision
recommendation_reason
next_step
risk_level
current_agent
claim_status
internal_summary
email_subject
email_body
voice_response
created_at
updated_at
```

## 16.2 interactions Table

Fields:

```text
id
interaction_id
claim_id
channel
customer_email
customer_phone
direction
subject
transcript
raw_body
intent
sentiment
status
created_at
updated_at
```

## 16.3 agent_tasks Table

Fields:

```text
id
task_id
claim_id
agent_name
task_type
status
started_at
completed_at
stuck_reason
result_summary
error_message
created_at
updated_at
```

## 16.4 audit_logs Table

Fields:

```text
id
audit_id
claim_id
agent_name
action
data_source
input_summary
result_summary
confidence
human_override
created_at
```

## 16.5 email_drafts Table

Fields:

```text
id
draft_id
claim_id
subject
body
status
generated_by
approved_by
sent_at
created_at
updated_at
```

## 16.6 voice_responses Table

Fields:

```text
id
response_id
claim_id
message
generated_by
created_at
```

---

## 17. Integration Requirements

## 17.1 Shopify Integration

### Required Capabilities

1. Find customer by email.
2. Find order by order number.
3. Get latest paddle order by customer email.
4. Get purchase date.
5. Get product/SKU.
6. Get shipping country.
7. Get fulfillment status.

### Constraints

1. Read-only access.
2. No order modification.
3. No customer modification.
4. No refunds/cancellations/fulfillment updates.

## 17.2 Warranty Registration DB Integration

### Required Capabilities

1. Find registration by email.
2. Find registration by order number.
3. Find registration by NFC ID.
4. Find registration by serial number.
5. Get registration date.
6. Get receipt upload status.
7. Get receipt approval status.
8. Get previous replacement count if available.

### Constraints

1. Read-only access.
2. No registration modification.
3. No receipt modification.

## 17.3 Vapi Integration

### Required Capabilities

1. Vapi sends customer input to backend endpoint.
2. Backend returns short voice-friendly response.
3. Backend logs transcript/interaction.
4. Backend creates or updates ticket.

## 17.4 Email Integration

### Phase 1

Use mock email events or manual input.

### Future Phase

1. Read support inbox.
2. Classify email.
3. Extract details and attachments.
4. Draft response.
5. Allow human approval before sending.

---

## 18. Demo Data Requirements

The demo must include these scenarios.

## 18.1 Approved NFC Extended Warranty

```text
email: demo.approved@example.com
country: US
orderNumber: 1001
purchaseDate: 2026-01-10
product: JOOLA Perseus Paddle
authorizedSeller: true
originalPurchaser: true
nfcChipEnabled: true
registrationDate: 2026-01-18
receiptUploaded: true
receiptApproved: true
previousReplacements: 0
Expected: 12-month warranty, active, eligible for damage review
```

## 18.2 Late Registration

```text
email: demo.late@example.com
purchaseDate: 2026-01-10
registrationDate: 2026-02-05
Expected: 6-month standard warranty
```

## 18.3 No Registration

```text
email: demo.noreg@example.com
purchaseDate: 2026-01-10
registration: not found
Expected: 6-month standard warranty
```

## 18.4 Unauthorized Seller

```text
email: demo.unauthorized@example.com
purchaseSource: eBay
authorizedSeller: false
Expected: Not eligible
```

## 18.5 Outside US/Canada

```text
email: demo.international@example.com
country: India
Expected: Not eligible under US/Canada warranty policy
```

## 18.6 Replacement Limit Reached

```text
email: demo.limit@example.com
warrantyType: 12_MONTH
previousReplacements: 3
maxReplacements: 3
Expected: Human review required / replacement limit reached
```

## 18.7 Product Has No Warranty

```text
email: demo.nowarrantyproduct@example.com
productType: pickleball_balls
Expected: Not eligible because product has no warranty
```

---

## 19. Email Response Requirements

## 19.1 Active Warranty

The email must:

1. Thank customer.
2. Confirm purchase was verified.
3. Confirm warranty type.
4. Confirm warranty is active.
5. Ask for damage photos/videos.
6. Avoid promising replacement.

## 19.2 Late or Missing Registration

The email must:

1. Explain extended 12-month warranty is unavailable.
2. Explain standard 6-month warranty applies.
3. Continue if claim is still within 6 months.
4. Explain expired status if outside 6 months.

## 19.3 Unauthorized Seller

The email must:

1. Thank customer.
2. Explain unauthorized seller rule.
3. Explain warranty is not available.
4. Recommend purchasing from JOOLA or authorized retailers.
5. Offer human review if appropriate.

## 19.4 Outside US/Canada

The email must:

1. Explain warranty coverage region.
2. Be empathetic.
3. Offer human review/regional support if available.

## 19.5 Replacement Limit Reached

The email must:

1. Explain replacement limit.
2. Avoid promising another replacement.
3. Escalate to human CS for review.

## 19.6 Warranty Expired

The email must:

1. Explain expiration based on purchase and registration data.
2. Be empathetic.
3. Offer available support options.

---

## 20. Voice Response Requirements

Voice response must be:

1. Short.
2. Conversational.
3. Clear.
4. Not overly legal.
5. Based on rule engine output.
6. Safe and non-committal until damage review is complete.

Example active 12-month warranty response:

```text
I found your purchase and confirmed your paddle was registered within 14 days with a valid receipt. That gives you the 12-month warranty, and it is currently active. The next step is to upload a few damage photos so our team can review the claim.
```

Example unauthorized seller response:

```text
I’m sorry, but this purchase appears to be from an unauthorized marketplace, so it is not eligible under JOOLA’s warranty policy. I can still create a case summary for our support team to review.
```

---

## 21. Security and Guardrails

## 21.1 Data Access

1. Use environment variables for credentials.
2. Do not hardcode secrets.
3. Shopify access must be read-only.
4. Warranty DB access must be read-only.
5. Claim system can write only to claim/ticket database.
6. Do not send live emails unless explicitly enabled.
7. Keep demo data separate from production data.

## 21.2 AI Guardrails

1. AI cannot override warranty rule engine.
2. AI cannot promise replacement before damage review.
3. AI cannot invent missing customer/order/registration data.
4. AI must escalate unclear or risky cases.
5. AI responses must be professional and empathetic.
6. AI must not provide legal interpretations beyond approved policy.

## 21.3 Audit Requirements

Log:

1. Shopify lookup.
2. Warranty DB lookup.
3. Warranty calculation.
4. AI-generated response.
5. Agent task status.
6. Human override.
7. Ticket status changes.
8. Email draft approval/sending.
9. Escalation creation.

---

## 22. Non-Functional Requirements

## 22.1 Performance

For demo:

1. Warranty check response should return within 3 seconds in mock mode.
2. Dashboard should load within 3 seconds.
3. Simulated events should appear within 5 seconds.

For production:

1. API response target: under 2 seconds for normal lookups.
2. Dashboard updates should be near real-time.
3. System should handle concurrent calls/emails.

## 22.2 Reliability

1. If Shopify is down, mark case as waiting for Shopify.
2. If warranty DB is down, mark case as waiting for warranty DB.
3. If Claude API is unavailable, use fallback templates.
4. If email generation fails, preserve case and alert CS Lead Agent.

## 22.3 Scalability

Future system should support:

1. Multiple concurrent agents.
2. Multiple support channels.
3. Large ticket volume.
4. Multi-region support.
5. Multiple brands/products if needed.

## 22.4 Maintainability

1. Warranty rules should be stored in a structured policy file/config.
2. Connectors should be isolated.
3. UI should consume APIs, not hardcoded data.
4. Agent logic should be modular.

---

## 23. Frontend Design Instruction

The frontend design is not defined in this BRD.

The CS frontend should be built by referring to the approved JOOLA-themed dashboard design/design system already provided separately.

This BRD only defines:

1. Functional screens.
2. Data requirements.
3. API needs.
4. Workflows.
5. Business logic.
6. Agent operations.
7. Dashboard management requirements.

The frontend implementation must not create its own unrelated visual style. It should strictly follow the approved CS dashboard design reference.

---

## 24. Implementation Phases

## Phase 1 — Demo Foundation

1. Build backend API.
2. Build mock Shopify connector.
3. Build mock warranty DB connector.
4. Build warranty rule engine.
5. Build claim storage.
6. Build email/voice draft services.
7. Build CS Lead Dashboard with mock data/events.
8. Build simulate incoming call/email buttons.
9. Build agent status tracking.
10. Build ticket detail and audit log.

## Phase 2 — Real Integrations

1. Connect real Shopify read-only API.
2. Connect real warranty registration DB read-only.
3. Connect Vapi tool endpoint.
4. Connect email inbox read mode.
5. Implement real event ingestion.

## Phase 3 — Operational Workflow

1. Human approval workflow.
2. Email sending after approval.
3. Escalation queue.
4. Customer 360.
5. SLA management.
6. Advanced audit logging.

## Phase 4 — Advanced Intelligence

1. Damage photo/video AI.
2. Fraud and duplicate claim detection.
3. Product defect trend analysis.
4. Replacement logistics integration.
5. Management reporting.

---

## 25. Acceptance Criteria

## 25.1 Functional Acceptance

The system is accepted when:

1. User can simulate incoming call.
2. User can simulate incoming email.
3. System creates a ticket.
4. System verifies Shopify data in demo mode.
5. System verifies warranty registration in demo mode.
6. System calculates warranty correctly.
7. System creates claim summary.
8. System generates email draft.
9. System generates voice response.
10. Dashboard shows ticket movement.
11. Dashboard shows active AI agent.
12. Dashboard shows stuck cases.
13. Dashboard shows escalations.
14. Dashboard shows audit events.

## 25.2 Policy Acceptance

The rule engine must correctly handle:

1. 12-month warranty for NFC registration within 14 days with valid receipt.
2. 6-month warranty for late registration.
3. 6-month warranty for no registration.
4. Not eligible for unauthorized seller.
5. Not eligible outside US/Canada.
6. Human review for replacement limit reached.
7. Not eligible for no-warranty product category.
8. Warranty expired when claim date is beyond expiry.

## 25.3 Dashboard Acceptance

Dashboard must show:

1. KPI summary.
2. Live activity.
3. Calls.
4. Emails.
5. Ticket pipeline.
6. Ticket detail.
7. Agent operations.
8. Stuck tickets.
9. Escalations.
10. Audit log.
11. Analytics summary.

## 25.4 Technical Acceptance

1. Application runs locally.
2. Mock mode works without real Shopify credentials.
3. Mock mode works without real Claude API key.
4. Real connector interfaces exist.
5. No secrets are hardcoded.
6. No write operation to Shopify.
7. No write operation to warranty registration system.
8. Claim records are stored locally in demo database.
9. APIs return consistent JSON.
10. README explains how to run and demo.

---

## 26. Open Questions

1. What is the actual warranty registration DB type?
2. What are the actual registration table and column names?
3. How is receipt approval stored?
4. How is previous replacement count currently tracked?
5. How do we identify authorized vs unauthorized retailers?
6. Does Shopify contain all third-party purchase data or only direct JOOLA purchases?
7. Should claim system be separate or integrated with an existing helpdesk?
8. Which email inbox/tool will be used for production?
9. Which fields will Vapi collect during calls?
10. What SLA rules should apply by channel and priority?
11. Who can approve AI-generated responses?
12. Who can override warranty decisions?
13. What regions outside US/Canada need separate handling?
14. Should India/APAC have separate warranty rules?
15. Should the system support multiple languages in future?

---

## 27. Success Metrics

## 27.1 Operational Metrics

1. Reduction in average first response time.
2. Reduction in manual lookup effort.
3. Increase in cases handled without human intervention.
4. Reduction in inconsistent warranty decisions.
5. Faster identification of stuck cases.
6. Faster escalation of high-risk cases.

## 27.2 Management Metrics

1. Claims by product model.
2. Claims by purchase source.
3. Claims by warranty type.
4. Late registration rate.
5. Unauthorized seller claim rate.
6. Replacement limit cases.
7. Average resolution time.
8. AI auto-handled percentage.
9. Human override percentage.
10. Customer sentiment trends.

---

## 28. Final Build Direction

The project should be built as a demo-ready AI Customer Support Warranty Management System.

Priority order:

1. Warranty rule engine.
2. Shopify/warranty DB lookup structure.
3. Claim creation.
4. Customer response generation.
5. CS Lead Dashboard.
6. Agent operations tracking.
7. Simulated call/email events.
8. Audit and reporting.

The demo must prove that JOOLA can manage warranty support using an AI agent team while keeping the human CS lead in control.

The frontend should refer to the approved JOOLA CS dashboard design from the separate design system. This BRD should be used as the functional and technical requirement baseline.

---

## Appendix A — Recommended Demo Flow

1. Open CS Lead Dashboard.
2. Click “Simulate Incoming Call.”
3. Customer says paddle broke.
4. Intake Agent creates ticket.
5. Shopify Agent verifies order.
6. Warranty Registration Agent verifies NFC registration.
7. Rule Engine calculates 12-month warranty.
8. Customer Response Agent drafts response.
9. Ticket moves to Eligible for Damage Review.
10. CS Lead Agent recommends requesting damage photos.
11. Open ticket detail and show full agent timeline.
12. Open Agent Operations and show all AI agents working.
13. Simulate unauthorized seller case.
14. Show escalation to human review.
15. Show audit log proving transparency.

---

## Appendix B — One-Line Vision

```text
An AI-powered customer support command center that connects Shopify, warranty registration, calls, emails, and claim management so JOOLA can handle warranty claims faster, more consistently, and with full operational visibility.
```
