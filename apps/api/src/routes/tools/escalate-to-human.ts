/**
 * Vapi tool: escalate_to_human
 *
 * - Inserts (or updates) a row in `escalations` keyed by claim id.
 * - Updates `claims.status_detail = ESCALATED`, `primary_agent_id = 'esc'`.
 * - Writes a CS_ESCALATED_MANUAL audit event with reason/priority/summary.
 *
 * Returns { ok, escalation_id } where escalation_id == claim_id (the PK).
 */

import type { FastifyPluginAsync } from 'fastify';

import { EscalateToHumanInput } from '../../types/tools.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/escalate_to_human', async (req, reply) => {
    const parsed = EscalateToHumanInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ tool: 'escalate_to_human', claim_id: input.claim_id });

    // Confirm claim exists before escalating.
    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .select('id')
      .eq('id', input.claim_id)
      .maybeSingle();
    if (claimErr) {
      log.error({ err: claimErr.message }, 'claim lookup failed');
      return reply.code(500).send({ error: 'lookup_failed' });
    }
    if (!claim) {
      return reply.code(404).send({ error: 'claim_not_found', claim_id: input.claim_id });
    }

    // Upsert the escalation row (id = claim_id — claim<->escalation is 1:1).
    const { error: escErr } = await app.supabase.from('escalations').upsert(
      {
        id: input.claim_id,
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

    // Mark claim escalated. `stage` matches the pipeline's terminal escalation
    // node (apps/ai-agents/app/graph/nodes/escalation.py).
    const { error: updateErr } = await app.supabase
      .from('claims')
      .update({
        status_detail: 'ESCALATED',
        primary_agent_id: 'esc',
        stage: 'esc',
      })
      .eq('id', input.claim_id);
    if (updateErr) {
      log.error({ err: updateErr.message }, 'claim update failed');
      // Continue — escalation is still queued; just log.
    }

    await app.audit(input.claim_id, 'CS_ESCALATED_MANUAL', 'AI', 'esc', {
      reason: input.reason,
      priority: input.priority,
      summary: input.summary,
      via: 'vapi_tool',
    });

    log.info({ priority: input.priority, reason: input.reason }, 'escalated');
    return reply.send({ ok: true, escalation_id: input.claim_id });
  });
};

export default route;
