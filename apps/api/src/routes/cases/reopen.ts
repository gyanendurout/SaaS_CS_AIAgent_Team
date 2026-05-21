/**
 * POST /api/cases/:id/reopen
 *
 * CS Lead reopens a closed/declined claim.
 *
 * Body: { category: reopen_category, note: string (min 5) }
 *
 * Idempotent: calling twice on the same claim just overwrites the note +
 * timestamp (claims has a CHECK constraint requiring category + note ≥5).
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ClaimRow, ReopenCategory } from '../../types/domain.js';

const Params = z.object({
  id: z.string().regex(/^WC-\d{5,}$/, 'Expected WC-XXXXX'),
});

const ReopenCategoryZ = z.enum([
  'customer_disputed',
  'damage_worsened',
  'new_info',
  'other',
]);

const Body = z.object({
  category: ReopenCategoryZ,
  note: z.string().min(5, 'note must be at least 5 characters'),
});

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/cases/:id/reopen', async (req, reply) => {
    const params = Params.safeParse(req.params);
    const body = Body.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        params: params.success ? null : params.error.flatten(),
        body: body.success ? null : body.error.flatten(),
      });
    }
    const claimId = params.data.id;
    const { category, note } = body.data;
    const log = req.log.child({ route: 'cases/reopen', claimId });

    // Capture prior state for the audit payload.
    const { data: prior, error: priorErr } = await app.supabase
      .from('claims')
      .select('id, status_detail, decision, display_status')
      .eq('id', claimId)
      .maybeSingle();
    if (priorErr) {
      log.error({ err: priorErr.message }, 'prior fetch failed');
      return reply.code(500).send({ error: 'lookup_failed' });
    }
    if (!prior) {
      return reply.code(404).send({ error: 'claim_not_found', claim_id: claimId });
    }
    const priorRow = prior as Pick<
      ClaimRow,
      'id' | 'status_detail' | 'decision' | 'display_status'
    >;

    const { error: updErr } = await app.supabase
      .from('claims')
      .update({
        status_detail: 'REOPENED',
        stage: 'intake',
        reopened_at: new Date().toISOString(),
        reopen_category: category as ReopenCategory,
        reopen_note: note,
        // Clear closed_at so handle_seconds re-computes.
        closed_at: null,
      })
      .eq('id', claimId);
    if (updErr) {
      log.error({ err: updErr.message }, 'reopen update failed');
      return reply.code(500).send({ error: 'reopen_failed', message: updErr.message });
    }

    await app.audit(claimId, 'CS_REOPENED', 'CS_LEAD', 'cs_lead_demo', {
      category,
      note,
      prior_status: priorRow.status_detail,
      prior_decision: priorRow.decision,
      prior_display_status: priorRow.display_status,
    });

    log.info({ category }, 'claim reopened');
    return reply.send({ ok: true, claim_id: claimId });
  });
};

export default route;
