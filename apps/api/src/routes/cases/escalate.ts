/**
 * POST /api/cases/:id/escalate
 *
 * CS Lead manually escalates a claim. Different from `escalate_to_human` (Vapi
 * tool) only in that the actor is a human, audit event differs, and we don't
 * verify Vapi context — but the DB writes are the same.
 *
 * Body: { reason, priority, summary }
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { EscalationPriorityEnum, EscalationReasonEnum } from '../../types/tools.js';

const Params = z.object({
  id: z.string().regex(/^WC-\d{5,}$/, 'Expected WC-XXXXX'),
});

const Body = z.object({
  reason: EscalationReasonEnum,
  priority: EscalationPriorityEnum,
  summary: z.string().min(1),
  actor_id: z.string().min(1).default('cs_lead_demo'),
});

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/cases/:id/escalate', async (req, reply) => {
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
    const input = body.data;
    const log = req.log.child({ route: 'cases/escalate', claimId });

    // Confirm claim exists.
    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .select('id')
      .eq('id', claimId)
      .maybeSingle();
    if (claimErr) {
      log.error({ err: claimErr.message }, 'claim lookup failed');
      return reply.code(500).send({ error: 'lookup_failed' });
    }
    if (!claim) {
      return reply.code(404).send({ error: 'claim_not_found', claim_id: claimId });
    }

    const { error: escErr } = await app.supabase.from('escalations').upsert(
      {
        id: claimId,
        priority: input.priority,
        reason: input.reason,
        summary: input.summary,
        wait_minutes: 0,
      },
      { onConflict: 'id' },
    );
    if (escErr) {
      log.error({ err: escErr.message }, 'escalation upsert failed');
      return reply.code(500).send({ error: 'escalation_failed' });
    }

    const { error: updErr } = await app.supabase
      .from('claims')
      .update({
        status_detail: 'ESCALATED',
        primary_agent_id: 'esc',
        stage: 'esc',
      })
      .eq('id', claimId);
    if (updErr) {
      log.error({ err: updErr.message }, 'claim update failed');
    }

    await app.audit(claimId, 'CS_ESCALATED_MANUAL', 'CS_LEAD', input.actor_id, {
      reason: input.reason,
      priority: input.priority,
      summary: input.summary,
      via: 'dashboard',
    });

    log.info({ priority: input.priority, reason: input.reason }, 'manual escalation');
    return reply.send({ ok: true, escalation_id: claimId, claim_id: claimId });
  });
};

export default route;
