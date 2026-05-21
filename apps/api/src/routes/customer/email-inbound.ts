/**
 * POST /api/customer/email/inbound
 *
 * Receives an inbound customer email. Resolves the customer from any
 * combination of signals (sender email, name in body, alt email in body,
 * order #), classifies the email as a warranty claim or a generic inquiry,
 * and routes accordingly:
 *
 *   - Warranty claim with resolvable identity  →  full 7-agent pipeline;
 *     draft awaits CS approval in the dashboard.
 *   - Generic inquiry (no warranty signal)     →  skip the rule engine, send
 *     an acknowledgement, and queue the case for human review.
 *
 * Body: { from/from_addr, to/to_addr?, subject, body, customer_id?, customer_name? }
 *
 * ── ADAPTER POINT — Inbound Email Transport ───────────────────────────────
 * This route currently acts as a POST endpoint called by the customer-demo
 * app. In production, replace (or supplement) this with a real inbound mail
 * hook from your email provider:
 *   • SendGrid Inbound Parse webhook  →  POST body maps to this schema
 *   • AWS SES + SNS notification      →  parse the SNS Message JSON
 *   • Postmark Inbound webhook        →  FromFull.Email, Subject, TextBody
 * The route contract (claim_id + status in the response) stays unchanged —
 * only the caller changes.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { FastifyBaseLogger, FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ClaimRow, CustomerRow, DraftRow } from '../../types/domain.js';

// Accept both shorthand (`from`, `to`) and the DB-aligned (`from_addr`,
// `to_addr`) forms.
const Body = z
  .object({
    from: z.string().email().optional(),
    from_addr: z.string().email().optional(),
    to: z.string().email().optional(),
    to_addr: z.string().email().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    customer_id: z.string().uuid().optional(),
    customer_name: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.from ?? d.from_addr), {
    message: 'from (or from_addr) is required',
    path: ['from'],
  })
  .transform((d) => ({
    from: (d.from ?? d.from_addr)!,
    to: d.to ?? d.to_addr,
    subject: d.subject,
    body: d.body,
    customer_id: d.customer_id,
    customer_name: d.customer_name,
  }));

type Input = z.infer<typeof Body>;

// ──────────────────────────────────────────────────────────────────────
// Heuristics for classifying email content
// ──────────────────────────────────────────────────────────────────────

const WARRANTY_KEYWORDS = [
  'warranty', 'claim', 'defect', 'broken', 'crack', 'cracked', 'cracking',
  'delaminat', 'peel', 'peeling', 'damaged', 'damage', 'refund', 'replace',
  'replacement', 'return', 'exchange', 'repair', 'rma', 'faulty', 'snapped',
  'split', 'chipping', 'chipped', 'fell apart', 'fell off', 'falling off',
  'fell apart', 'stopped working', 'not working', 'malfunction', 'dead spot',
  'safety', 'injury', 'cracked frame', 'soft spot', 'hot spot',
];

const ORDER_PREFIXES_PATTERN = /\b([A-Z]{2})[-_ ]?(\d{4,})\b/i;

/** Returns null if no order ref found, else the candidates to look up. */
function extractOrderRef(text: string): { ref: string; candidates: string[] } | null {
  const m = text.match(ORDER_PREFIXES_PATTERN);
  if (!m) return null;
  const prefix = m[1]!.toUpperCase();
  const num = m[2]!;
  return {
    ref: m[0]!,
    candidates: [`${prefix}-${num}`, `${prefix}${num}`, m[0]!.toUpperCase()],
  };
}

/** Returns email addresses mentioned inside the body (excluding sender). */
function extractAltEmails(text: string, exclude: string): string[] {
  const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const found = (text.match(re) ?? [])
    .map((e) => e.toLowerCase())
    .filter((e) => e !== exclude.toLowerCase());
  return Array.from(new Set(found));
}

/**
 * Returns a best-effort full name extracted from the email body.
 * Looks for "I'm X Y" / "My name is X Y" / "this is X Y" / closing signature.
 */
function extractCustomerName(text: string): string | null {
  const patterns = [
    /\b(?:my name is|i['’]m|this is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/,
    /(?:regards|thanks|sincerely|cheers|best),?\s*\n+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/**
 * Classifies the inbound message as a warranty-related case or a generic
 * inquiry. Used to decide whether to fire the 7-agent pipeline or to short-
 * circuit to a human-review escalation.
 */
function classifyEmail(text: string): {
  isWarrantyClaim: boolean;
  hasOrderRef: boolean;
  matchedKeywords: string[];
} {
  const lower = text.toLowerCase();
  const matchedKeywords = WARRANTY_KEYWORDS.filter((k) => lower.includes(k));
  const hasOrderRef = ORDER_PREFIXES_PATTERN.test(text);
  return {
    isWarrantyClaim: matchedKeywords.length > 0 || hasOrderRef,
    hasOrderRef,
    matchedKeywords,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Customer resolution (sender → body name → alt email → order # → new)
// ──────────────────────────────────────────────────────────────────────

interface ResolveResult {
  customerId: string;
  orderId: string | null;
  /** Where the match came from — surfaced in audit. */
  source:
    | 'explicit_id'
    | 'sender_email'
    | 'body_alt_email'
    | 'body_name'
    | 'order_owner'
    | 'created_new';
  identityVerified: boolean;
}

async function resolveCustomer(
  app: FastifyInstance,
  input: Input,
  log: FastifyBaseLogger,
): Promise<ResolveResult> {
  // a) Explicit customer_id.
  if (input.customer_id) {
    return { customerId: input.customer_id, orderId: null, source: 'explicit_id', identityVerified: true };
  }

  const haystack = `${input.subject}\n${input.body}`;

  // b) Sender email.
  const { data: bySender } = await app.supabase
    .from('customers')
    .select('id')
    .ilike('email', input.from)
    .limit(1)
    .maybeSingle();
  if (bySender) {
    return { customerId: (bySender as Pick<CustomerRow, 'id'>).id, orderId: null, source: 'sender_email', identityVerified: true };
  }

  // c) Alternate email mentioned in body (e.g. "my account email is X@Y.com").
  const altEmails = extractAltEmails(haystack, input.from);
  for (const alt of altEmails) {
    const { data } = await app.supabase
      .from('customers')
      .select('id')
      .ilike('email', alt)
      .limit(1)
      .maybeSingle();
    if (data) {
      log.info({ alt }, 'resolved customer via alternate email in body');
      return { customerId: (data as Pick<CustomerRow, 'id'>).id, orderId: null, source: 'body_alt_email', identityVerified: true };
    }
  }

  // d) Name in body.
  const nameFromBody = input.customer_name ?? extractCustomerName(haystack);
  if (nameFromBody) {
    const { data } = await app.supabase
      .from('customers')
      .select('id')
      .ilike('name', nameFromBody)
      .limit(1)
      .maybeSingle();
    if (data) {
      log.info({ nameFromBody }, 'resolved customer via name in body');
      return { customerId: (data as Pick<CustomerRow, 'id'>).id, orderId: null, source: 'body_name', identityVerified: false };
    }
  }

  // e) Order number → customer.
  const orderRef = extractOrderRef(haystack);
  if (orderRef) {
    const { data: order } = await app.supabase
      .from('orders')
      .select('id, customer_id')
      .in('order_number', orderRef.candidates)
      .limit(1)
      .maybeSingle();
    if (order) {
      const row = order as { id: string; customer_id: string };
      log.info({ orderRef: orderRef.ref }, 'resolved customer via order owner');
      return { customerId: row.customer_id, orderId: row.id, source: 'order_owner', identityVerified: false };
    }
  }

  // f) Fallback: create a new customer record for this email.
  const { data: created, error: insErr } = await app.supabase
    .from('customers')
    .insert({
      email: input.from,
      name: nameFromBody ?? input.from.split('@')[0]!,
    })
    .select('id')
    .single();
  if (insErr || !created) {
    throw new Error(insErr?.message ?? 'customer insert failed');
  }
  log.info({ email: input.from, name: nameFromBody }, 'created new customer record');
  return { customerId: (created as Pick<CustomerRow, 'id'>).id, orderId: null, source: 'created_new', identityVerified: false };
}

// ──────────────────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────────────────

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/customer/email/inbound', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ route: 'customer/email/inbound', from: input.from });

    // 1. Resolve customer from any available signal.
    let resolved: ResolveResult;
    try {
      resolved = await resolveCustomer(app, input, log);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'customer resolution failed');
      return reply.code(500).send({ error: 'customer_resolve_failed' });
    }
    const customerId = resolved.customerId;

    // 2. Resolve the order to attach to the claim. Either it came from the
    //    customer resolver (order #), or we explicitly look it up here.
    let orderId: string | null = resolved.orderId;
    if (!orderId) {
      const orderRef = extractOrderRef(`${input.subject}\n${input.body}`);
      if (orderRef) {
        const { data: order } = await app.supabase
          .from('orders')
          .select('id')
          .in('order_number', orderRef.candidates)
          .limit(1)
          .maybeSingle();
        orderId = (order as { id: string } | null)?.id ?? null;
        log.info({ orderRef: orderRef.ref, orderId }, 'order extracted from email body');
      }
    }

    // 3. Decide which claim this email belongs to:
    //    a) reuse an in-progress email claim (intake/draft/esc) for this
    //       customer — the new mail is a follow-up while CS is working it, OR
    //    b) the claim is in AWAITING_CUSTOMER_REPLY — CS sent an info-request
    //       and the customer is now providing the missing details; re-run the
    //       full pipeline with the new information, OR
    //    c) reopen the most recent CLOSED email claim from this customer if
    //       it closed within the last 72h — the customer is replying to an
    //       AI/CS reply, forming a chain, OR
    //    d) create a brand-new claim.
    const { data: openRow } = await app.supabase
      .from('claims')
      .select('id, stage, status_detail')
      .eq('customer_id', customerId)
      .eq('channel', 'email')
      .eq('display_status', 'OPEN')
      .in('stage', ['intake', 'draft', 'esc'])
      .neq('status_detail', 'AWAITING_CUSTOMER_REPLY')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let claimId = (openRow as Pick<ClaimRow, 'id'> | null)?.id ?? null;
    let isChainFollowUp = false;
    let isAwaitingReply = false;

    // (b) Check for a claim explicitly waiting for customer info.
    if (!claimId) {
      const { data: awaitingRow } = await app.supabase
        .from('claims')
        .select('id')
        .eq('customer_id', customerId)
        .eq('channel', 'email')
        .eq('status_detail', 'AWAITING_CUSTOMER_REPLY')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (awaitingRow) {
        claimId = (awaitingRow as Pick<ClaimRow, 'id'>).id;
        isAwaitingReply = true;
        // Transition back to intake so the full pipeline re-runs.
        const { error: updErr } = await app.supabase
          .from('claims')
          .update({
            stage: 'intake',
            status_detail: 'REOPENED',
            primary_agent_id: null,
          })
          .eq('id', claimId);
        if (updErr) {
          log.error({ err: updErr.message, claimId }, 'awaiting-reply transition failed');
        }
        await app.audit(claimId, 'CUSTOMER_INFO_RECEIVED', 'CUSTOMER', customerId, {
          subject: input.subject,
          trigger: 'awaiting_reply',
        });
        log.info({ claimId }, 'customer provided info — re-running pipeline');
      }
    }

    if (!claimId) {
      // (c) Look for a recently CLOSED email claim from this customer — if they
      // reply within 72h, this is a chain (they're responding to our reply).
      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: recentClosed } = await app.supabase
        .from('claims')
        .select('id, closed_at, decision')
        .eq('customer_id', customerId)
        .eq('channel', 'email')
        .gte('closed_at', threeDaysAgo)
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentClosed) {
        const recentRow = recentClosed as Pick<ClaimRow, 'id'> & { closed_at: string; decision: string };
        claimId = recentRow.id;
        isChainFollowUp = true;
        // Reopen the closed claim and clear closed_at so it surfaces live again.
        const reopenNote = `Customer replied to closed claim. Subject: ${input.subject.slice(0, 80)}`;
        const { error: reopenErr } = await app.supabase
          .from('claims')
          .update({
            stage: 'intake',
            status_detail: 'REOPENED',
            closed_at: null,
            reopened_at: new Date().toISOString(),
            reopen_category: 'customer_disputed',
            reopen_note: reopenNote,
            primary_agent_id: null,
          })
          .eq('id', claimId);
        if (reopenErr) {
          log.error({ err: reopenErr.message, claimId }, 'chain-reopen update failed');
        }
        await app.audit(claimId, 'CUST_REPLY_REOPENED', 'CUSTOMER', customerId, {
          subject: input.subject,
          prior_decision: recentRow.decision,
        });
        log.info({ claimId }, 'reopened recently-closed claim due to customer follow-up');
      }
    }

    if (!claimId) {
      const { data: created, error: claimErr } = await app.supabase
        .from('claims')
        .insert({
          customer_id: customerId,
          order_id: orderId,
          channel: 'email',
          issue: input.subject,
          status_detail: 'NEW',
          stage: 'intake',
        })
        .select('id')
        .single();
      if (claimErr || !created) {
        log.error({ err: claimErr?.message }, 'claim insert failed');
        return reply.code(500).send({ error: 'claim_insert_failed' });
      }
      claimId = (created as Pick<ClaimRow, 'id'>).id;
    }

    // 4. Persist the inbound email row.
    const { error: emailErr } = await app.supabase.from('emails').insert({
      claim_id: claimId,
      direction: 'inbound',
      from_addr: input.from,
      to_addr: input.to ?? 'support@joola.com',
      subject: input.subject,
      body: input.body,
      sent_at: new Date().toISOString(),
    });
    if (emailErr) {
      log.error({ err: emailErr.message }, 'email insert failed');
      return reply.code(500).send({ error: 'email_insert_failed' });
    }

    await app.audit(claimId, 'CUST_EMAIL_RECEIVED', 'CUSTOMER', customerId, {
      subject: input.subject,
      body_length: input.body.length,
      resolver_source: resolved.source,
      identity_verified: resolved.identityVerified,
    });

    // 5. Classify the email. Generic inquiries skip the rule engine entirely
    //    so the dashboard's escalation queue surfaces them with a precise
    //    reason instead of "UNHANDLED_CASE / fallback".
    const classification = classifyEmail(`${input.subject}\n${input.body}`);
    log.info({ classification }, 'email classified');

    if (!classification.isWarrantyClaim) {
      await routeToHuman({
        app,
        claimId,
        toAddr: input.from,
        reason: 'AMBIGUOUS_DAMAGE',
        summary: `Generic customer inquiry — not a warranty case. Customer wrote: "${input.subject.slice(0, 120)}"`,
        ackBody: buildGenericAck(input.subject),
        ackSubject: `Re: ${input.subject}`,
        log,
      });
      return reply.send({ claim_id: claimId, status: 'queued_for_human' });
    }

    // 6. Run the 7-agent pipeline. raw_input carries the customer's actual
    //    subject + body so the response drafter can reference it instead of
    //    generating a generic reply.
    try {
      const pipeline = await app.aiAgents.runPipeline({
        claim_id: claimId,
        channel: 'email',
        raw_input: {
          issue: `${input.subject}\n\n${input.body}`,
          customer_email: input.from,
        },
      });
      log.info(
        {
          claim_id: claimId,
          decision: pipeline.decision,
          draft_id: pipeline.draft_id,
          chain_followup: isChainFollowUp,
          awaiting_reply: isAwaitingReply,
        },
        'pipeline complete — draft awaiting CS approval (auto-send disabled)',
      );
      // NOTE: auto-send disabled. The draft sits in `pending_approval` until
      // a CS Lead approves (or edits + approves) via the case drawer. The
      // helper `autoSendDraft()` is still defined below for the create_claim
      // tool path or future re-enable, but is no longer invoked here.
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err), claim_id: claimId },
        'pipeline failed — claim still queued',
      );
    }

    return reply.send({ claim_id: claimId, status: 'received' });
  });
};

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Builds a short, friendly acknowledgement body for non-warranty inquiries.
 * Tells the customer a human will respond so they don't get crickets.
 */
function buildGenericAck(subject: string): string {
  return (
    `Hi there,\n\n` +
    `Thanks for reaching out to JOOLA support about "${subject}". This looks like a general inquiry ` +
    `rather than a warranty case — one of our customer service team members will get back to you ` +
    `shortly with a personalised answer.\n\n` +
    `If your question is about an existing warranty claim or a defective product, please reply ` +
    `including your order number (e.g. JD-100002) and a brief description of the issue and we'll ` +
    `route it through the right channel right away.\n\n` +
    `Best regards,\nJOOLA Customer Support`
  );
}

/**
 * Generic-inquiry / unverifiable-identity path: send an acknowledgement,
 * insert an escalation row so the case shows in the dashboard's human queue,
 * and mark the claim as escalated. Does NOT close the claim — a CS Lead has
 * to take over.
 */
async function routeToHuman(args: {
  app: FastifyInstance;
  claimId: string;
  toAddr: string;
  reason: 'AMBIGUOUS_DAMAGE' | 'DISPUTED_SELLER' | 'BRAND_RISK' | 'SAFETY' | 'OUTSIDE_REGION' | 'REPLACEMENT_LIMIT_REACHED';
  summary: string;
  ackSubject: string;
  ackBody: string;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { app, claimId, toAddr, reason, summary, ackSubject, ackBody, log } = args;
  const now = new Date().toISOString();

  await app.supabase.from('emails').insert({
    claim_id: claimId,
    direction: 'outbound',
    from_addr: 'support@joola.com',
    to_addr: toAddr,
    subject: ackSubject,
    body: ackBody,
    sent_at: now,
  });

  await app.supabase.from('escalations').upsert({
    id: claimId,
    priority: 'norm',
    reason,
    summary,
    wait_minutes: 0,
  });

  const { error: claimErr } = await app.supabase
    .from('claims')
    .update({
      stage: 'esc',
      status_detail: 'ESCALATED',
      primary_agent_id: 'esc',
    })
    .eq('id', claimId);
  if (claimErr) {
    log.error({ err: claimErr.message, claimId }, 'route-to-human: claim update failed');
  }

  await app.audit(claimId, 'AI_ESCALATED', 'AI', 'esc', {
    reason,
    summary,
    auto_routed: true,
    channel: 'email',
  });

  log.info({ claimId, reason }, 'route-to-human: ack sent + escalation queued');
}

/**
 * Auto-approves a pending draft for the email channel: marks the draft as
 * approved by `ai_auto`, inserts the outbound email row, and closes the claim.
 *
 * NOTE: this function is intentionally NOT called in the main route — CS must
 * approve via the dashboard. It is kept for the create_claim tool path and as
 * a reference if auto-send is re-enabled in future.
 *
 * ── ADAPTER POINT — Outbound Email Transport ──────────────────────────────
 * The `app.supabase.from('emails').insert(...)` below writes a row so the
 * dashboard thread shows the reply. In production, also (or instead) call
 * your real email SDK here. Same contract as approve-draft.ts step 6.
 * ────────────────────────────────────────────────────────────────────────────
 */
async function autoSendDraft(args: {
  app: FastifyInstance;
  claimId: string;
  draftId: string;
  toAddr: string;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { app, claimId, draftId, toAddr, log } = args;
  const now = new Date().toISOString();

  const { data: draft, error: draftErr } = await app.supabase
    .from('drafts')
    .select('id, email_subject, email_body, status')
    .eq('id', draftId)
    .maybeSingle();
  if (draftErr || !draft) {
    log.error({ err: draftErr?.message, draftId }, 'auto-send: draft lookup failed');
    return;
  }
  const draftRow = draft as Pick<DraftRow, 'id' | 'email_subject' | 'email_body' | 'status'>;
  if (!draftRow.email_subject || !draftRow.email_body) {
    log.warn({ draftId }, 'auto-send: draft has no email body — skipping send');
    return;
  }

  const { error: updErr } = await app.supabase
    .from('drafts')
    .update({ status: 'approved', approved_by: 'ai_auto', approved_at: now })
    .eq('id', draftId);
  if (updErr) {
    log.error({ err: updErr.message, draftId }, 'auto-send: draft approve failed');
    return;
  }

  const { error: emailErr } = await app.supabase.from('emails').insert({
    claim_id: claimId,
    direction: 'outbound',
    from_addr: 'support@joola.com',
    to_addr: toAddr,
    subject: draftRow.email_subject,
    body: draftRow.email_body,
    sent_at: now,
  });
  if (emailErr) {
    log.error({ err: emailErr.message, claimId }, 'auto-send: outbound email insert failed');
    return;
  }

  const { error: claimErr } = await app.supabase
    .from('claims')
    .update({
      stage: 'closed',
      status_detail: 'CLOSED_RESOLVED',
      closed_at: now,
      primary_agent_id: 'response',
    })
    .eq('id', claimId);
  if (claimErr) {
    log.error({ err: claimErr.message, claimId }, 'auto-send: claim close failed');
  }

  await app.audit(claimId, 'CS_DRAFT_APPROVED', 'AI', 'ai_auto', {
    draft_id: draftId,
    auto_approved: true,
    channel: 'email',
  });

  log.info({ claimId, draftId }, 'auto-send: email reply delivered & claim closed');
}

export default route;
