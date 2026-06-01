/**
 * POST /api/cases/:id/approve-draft
 *
 * CS Lead approves the AI-drafted reply for a claim. Optionally edits the
 * voice / email text before approving (recorded as `status='edited'`).
 *
 * Side effects:
 *   - drafts.status = 'approved' (or 'edited'); approved_by + approved_at set
 *   - claims.stage = 'closed', status_detail = 'CLOSED_RESOLVED',
 *     closed_at = now(), primary_agent_id = 'response'
 *   - If the claim's channel is 'email', insert an outbound email row from
 *     the (possibly edited) draft so the customer sees the reply.
 *   - Audit event CS_DRAFT_APPROVED.
 *
 * Body: { draft_id?, edited_voice?, edited_email_subject?, edited_email_body? }
 *   draft_id is optional — defaults to the most recent pending_approval draft.
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

const APPROVAL_TIMESTAMP = (): string => new Date().toISOString();

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/cases/:id/approve-draft', async (req, reply) => {
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
    const log = req.log.child({ route: 'cases/approve-draft', claimId });

    // 1. Load claim (for channel + customer info needed if we send email).
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
    // Supabase's generated types declare to-one joins as arrays, but the
    // runtime returns a single object for foreign-key joins. Go through
    // `unknown` to bridge the deliberate type mismatch.
    const claimRow = claim as unknown as Pick<ClaimRow, 'id' | 'channel' | 'customer_id'> & {
      customers: { email: string; name: string } | null;
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

    // 3. Compute final text (edits override draft).
    const finalVoice = input.edited_voice ?? draftRow.voice_text ?? null;
    const finalSubject = input.edited_email_subject ?? draftRow.email_subject ?? null;
    const finalBody = input.edited_email_body ?? draftRow.email_body ?? null;
    const wasEdited = Boolean(
      input.edited_voice || input.edited_email_subject || input.edited_email_body,
    );

    // 4. Update draft.
    const approvedAt = APPROVAL_TIMESTAMP();
    const { error: updDraftErr } = await app.supabase
      .from('drafts')
      .update({
        status: wasEdited ? 'edited' : 'approved',
        approved_by: input.approved_by,
        approved_at: approvedAt,
        voice_text: finalVoice,
        email_subject: finalSubject,
        email_body: finalBody,
      })
      .eq('id', draftRow.id);
    if (updDraftErr) {
      log.error({ err: updDraftErr.message }, 'draft update failed');
      return reply.code(500).send({ error: 'draft_update_failed' });
    }

    // 5. Update claim to closed.
    const { error: updClaimErr } = await app.supabase
      .from('claims')
      .update({
        stage: 'closed',
        status_detail: 'CLOSED_RESOLVED',
        closed_at: approvedAt,
        primary_agent_id: 'response',
      })
      .eq('id', claimId);
    if (updClaimErr) {
      log.error({ err: updClaimErr.message }, 'claim close failed');
      // Continue — draft is already approved, claim update can be retried.
    }

    // 6. ── ADAPTER POINT — Email Transport ──────────────────────────────────
    //    Currently writes a row to `emails` (Supabase) so the dashboard thread
    //    shows the outbound message. In production, replace the supabase.insert
    //    call below with your real email transport:
    //      • SendGrid: sgMail.send({ to, from, subject, text/html })
    //      • AWS SES:  sesClient.send(new SendEmailCommand({ ... }))
    //      • Nodemailer / SMTP: transporter.sendMail({ ... })
    //    Keep the emails.insert so the thread remains visible in the dashboard,
    //    OR replace it entirely if your ESP webhook writes back to the table.
    //    The `sent_at`, `from_addr`, `to_addr`, `subject`, `body` values are
    //    already computed above — just pass them to whichever SDK you choose.
    // ────────────────────────────────────────────────────────────────────────
    if (claimRow.channel === 'email' && finalBody && finalSubject) {
      const toAddr = claimRow.customers?.email;
      if (toAddr) {
        const { error: emailErr } = await app.supabase.from('emails').insert({
          claim_id: claimId,
          direction: 'outbound',
          from_addr: 'support@joola.com',
          to_addr: toAddr,
          subject: finalSubject,
          body: finalBody,
          sent_at: approvedAt,
        });
        if (emailErr) {
          log.error({ err: emailErr.message }, 'outbound email insert failed');
        }
      } else {
        log.warn('no customer email on file — outbound reply not sent');
      }
    }

    await app.audit(claimId, 'CS_DRAFT_APPROVED', 'CS_LEAD', input.approved_by, {
      draft_id: draftRow.id,
      edited: wasEdited,
      channel: claimRow.channel,
    });

    log.info({ draft_id: draftRow.id, edited: wasEdited }, 'draft approved');
    return reply.send({ ok: true, claim_id: claimId, draft_id: draftRow.id });
  });

  /**
   * POST /api/cases/:id/edit-draft
   *
   * Save in-progress edits without approving. Useful for the dashboard's
   * "Save Edit" button. Marks draft.status='edited' but leaves the claim open.
   */
  app.post('/api/cases/:id/edit-draft', async (req, reply) => {
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
    const log = req.log.child({ route: 'cases/edit-draft', claimId });

    let draftQuery = app.supabase
      .from('drafts')
      .select('id')
      .eq('claim_id', claimId);
    if (input.draft_id) draftQuery = draftQuery.eq('id', input.draft_id);
    const { data: draft } = await draftQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!draft) {
      return reply.code(404).send({ error: 'draft_not_found' });
    }
    const draftId = (draft as Pick<DraftRow, 'id'>).id;

    const patch: Partial<DraftRow> & { status: DraftRow['status'] } = {
      status: 'edited',
    };
    if (input.edited_voice !== undefined) patch.voice_text = input.edited_voice;
    if (input.edited_email_subject !== undefined) patch.email_subject = input.edited_email_subject;
    if (input.edited_email_body !== undefined) patch.email_body = input.edited_email_body;

    const { error } = await app.supabase.from('drafts').update(patch).eq('id', draftId);
    if (error) {
      log.error({ err: error.message }, 'draft edit failed');
      return reply.code(500).send({ error: 'draft_update_failed' });
    }

    await app.audit(claimId, 'CS_DRAFT_EDITED', 'CS_LEAD', input.approved_by, {
      draft_id: draftId,
      fields_edited: Object.keys(patch).filter((k) => k !== 'status'),
    });

    return reply.send({ ok: true, claim_id: claimId, draft_id: draftId });
  });
};

export default route;
