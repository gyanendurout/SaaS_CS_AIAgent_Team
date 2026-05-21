h/**
 * POST /api/cases/:id/send-await-reply
 *
 * CS Lead sends a "we need more information" reply to the customer but keeps
 * the claim open in AWAITING_CUSTOMER_REPLY state (not closed).
 *
 * Differences from approve-draft:
 *   - claim.stage stays 'draft'; status_detail → 'AWAITING_CUSTOMER_REPLY'
 *   - closed_at is NOT set — the case remains live in the feed
 *   - When the customer replies, email-inbound.ts detects this state and
 *     re-runs the full pipeline with the new information.
 *
 * Body: same shape as approve-draft (edits are optional)
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ClaimRow, DraftRow } from '../../types/domain.js';

const Params = z.object({
  id: z.string().regex(/^WC-\d{5,}$/, 'Expected WC-XXXXX'),
});

const Body = z.object({
  draft_id: z.string().uuid().optional(),
  edited_voice: z.string().min(1).optional(),
  edited_email_subject: z.string().min(1).optional(),
  edited_email_body: z.string().min(1).optional(),
  approved_by: z.string().min(1).default('cs_lead_demo'),
});

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/cases/:id/send-await-reply', async (req, reply) => {
    const params = Params.safeParse(req.params);
    const body = Body.safeParse(req.body ?? {});
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        params: params.success ? null : params.error.flatten(),
        body: body.success ? null : body.error.flatten(),
      });
    }
    const claimId = params.data.id;
    const input = body.data;
    const log = req.log.child({ route: 'cases/send-await-reply', claimId });

    // 1. Load claim.
    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .select('id, channel, customer_id, customers:customer_id(email, name)')
      .eq('id', claimId)
      .maybeSingle();
    if (claimErr) {
      log.error({ err: claimErr.message }, 'claim lookup failed');
      return reply.code(500).send({ error: 'lookup_failed' });
    }
    if (!claim) {
      return reply.code(404).send({ error: 'claim_not_found', claim_id: claimId });
    }
    const claimRow = claim as Pick<ClaimRow, 'id' | 'channel' | 'customer_id'> & {
      customers: { email: string; name: string }[] | null;
    };

    // 2. Pick the draft.
    let draftQuery = app.supabase
      .from('drafts')
      .select('*')
      .eq('claim_id', claimId);
    if (input.draft_id) {
      draftQuery = draftQuery.eq('id', input.draft_id);
    } else {
      draftQuery = draftQuery.eq('status', 'pending_approval');
    }
    const { data: draft, error: draftErr } = await draftQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (draftErr) {
      log.error({ err: draftErr.message }, 'draft lookup failed');
      return reply.code(500).send({ error: 'lookup_failed' });
    }
    if (!draft) {
      return reply.code(404).send({ error: 'draft_not_found' });
    }
    const draftRow = draft as DraftRow;

    // 3. Compute final text.
    const finalSubject = input.edited_email_subject ?? draftRow.email_subject ?? null;
    const finalBody = input.edited_email_body ?? draftRow.email_body ?? null;
    const wasEdited = Boolean(input.edited_email_subject || input.edited_email_body);

    // 4. Mark draft approved (not closed — just sent as info-request).
    const sentAt = new Date().toISOString();
    const { error: updDraftErr } = await app.supabase
      .from('drafts')
      .update({
        status: wasEdited ? 'edited' : 'approved',
        approved_by: input.approved_by,
        approved_at: sentAt,
        email_subject: finalSubject,
        email_body: finalBody,
      })
      .eq('id', draftRow.id);
    if (updDraftErr) {
      log.error({ err: updDraftErr.message }, 'draft update failed');
      return reply.code(500).send({ error: 'draft_update_failed' });
    }

    // 5. Keep claim open — only update status_detail to AWAITING_CUSTOMER_REPLY.
    const { error: updClaimErr } = await app.supabase
      .from('claims')
      .update({
        status_detail: 'AWAITING_CUSTOMER_REPLY',
        primary_agent_id: 'response',
      })
      .eq('id', claimId);
    if (updClaimErr) {
      log.error({ err: updClaimErr.message }, 'claim status update failed');
    }

    // 6. Send the outbound email (same adapter point as approve-draft step 6).
    if (claimRow.channel === 'email' && finalBody && finalSubject) {
      const toAddr = claimRow.customers?.[0]?.email;
      if (toAddr) {
        const { error: emailErr } = await app.supabase.from('emails').insert({
          claim_id: claimId,
          direction: 'outbound',
          from_addr: 'support@joola.com',
          to_addr: toAddr,
          subject: finalSubject,
          body: finalBody,
          sent_at: sentAt,
        });
        if (emailErr) {
          log.error({ err: emailErr.message }, 'outbound email insert failed');
        }
      } else {
        log.warn('no customer email on file — info-request email not sent');
      }
    }

    await app.audit(claimId, 'CS_SENT_AWAITING_REPLY', 'CS_LEAD', input.approved_by, {
      draft_id: draftRow.id,
      edited: wasEdited,
      channel: claimRow.channel,
    });

    log.info({ draft_id: draftRow.id }, 'info-request email sent — claim awaiting customer reply');
    return reply.send({ ok: true, claim_id: claimId, draft_id: draftRow.id });
  });
};

export default route;
