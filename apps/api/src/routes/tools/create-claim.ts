/**
 * Vapi tool: create_claim
 *
 * Inserts a new row in `claims` (id auto-gen WC-XXXXX via Postgres sequence).
 * Resolves customer_id from email if needed (creates a customer on the fly).
 * Writes an initial AI_CLAIM_CREATED case_event.
 *
 * Returns: { claim_id, status_detail }.
 */

import type { FastifyPluginAsync } from 'fastify';

import { CreateClaimInput } from '../../types/tools.js';
import type { ClaimRow, CustomerRow, OrderRow } from '../../types/domain.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/create_claim', async (req, reply) => {
    const parsed = CreateClaimInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ tool: 'create_claim' });

    // 1. Resolve customer.
    let customerId = input.customer_id ?? null;
    if (!customerId) {
      if (!input.customer_email) {
        return reply.code(400).send({
          error: 'missing_customer',
          message: 'Provide customer_id OR customer_email',
        });
      }
      const { data: existing, error: lookupErr } = await app.supabase
        .from('customers')
        .select('id')
        .ilike('email', input.customer_email)
        .limit(1)
        .maybeSingle();
      if (lookupErr) {
        log.error({ err: lookupErr.message }, 'customer lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      if (existing) {
        customerId = (existing as Pick<CustomerRow, 'id'>).id;
      } else {
        const { data: created, error: insErr } = await app.supabase
          .from('customers')
          .insert({
            email: input.customer_email,
            name: input.customer_name ?? input.customer_email.split('@')[0]!,
          })
          .select('id')
          .single();
        if (insErr || !created) {
          log.error({ err: insErr?.message }, 'customer insert failed');
          return reply.code(500).send({ error: 'customer_insert_failed' });
        }
        customerId = (created as Pick<CustomerRow, 'id'>).id;
      }
    }

    // 2. Resolve order (optional — voice claims may have no order match yet).
    let orderId = input.order_id ?? null;
    if (!orderId && input.order_number) {
      const normalised = input.order_number.replace(/^JL[-_ ]?/i, '');
      const { data } = await app.supabase
        .from('orders')
        .select('id')
        .or(`order_number.eq.${normalised},order_number.eq.${input.order_number}`)
        .limit(1)
        .maybeSingle();
      orderId = (data as Pick<OrderRow, 'id'> | null)?.id ?? null;
    }

    // 3. Idempotency: voice flow pre-creates a placeholder via
    //    /api/customer/voice/start. If the model then calls create_claim
    //    mid-call, we'd otherwise insert a duplicate. Reuse a recent open
    //    voice placeholder for this customer instead.
    const decision = input.decision ?? 'PROCESSING';
    const statusDetail =
      decision === 'PROCESSING' ? 'IN_RULE_EVAL'
      : decision === 'HUMAN_REVIEW_REQUIRED' ? 'ESCALATED'
      : decision === 'NOT_ELIGIBLE' || decision === 'WARRANTY_EXPIRED' ? 'CLOSED_DECLINED'
      : 'AWAITING_VERIFICATION';

    if (input.channel === 'voice') {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data: placeholder } = await app.supabase
        .from('claims')
        .select('id, status_detail')
        .eq('customer_id', customerId)
        .eq('channel', 'voice')
        .in('status_detail', ['NEW', 'IN_RULE_EVAL'])
        .gte('created_at', fifteenMinAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (placeholder) {
        const existing = placeholder as Pick<ClaimRow, 'id' | 'status_detail'>;
        const { data: updated, error: updErr } = await app.supabase
          .from('claims')
          .update({
            order_id: orderId,
            issue: input.issue,
            status_detail: statusDetail,
            decision,
            reason_code: input.reason_code ?? null,
            citation: input.citation ?? null,
            sentiment: input.sentiment ?? null,
            primary_agent_id: decision === 'PROCESSING' ? null : 'rules',
            stage: decision === 'PROCESSING' ? 'verify' : 'rules',
          })
          .eq('id', existing.id)
          .select('id, status_detail')
          .single();

        if (updErr || !updated) {
          log.error({ err: updErr?.message }, 'placeholder update failed');
          return reply.code(500).send({ error: 'claim_update_failed' });
        }

        const updRow = updated as Pick<ClaimRow, 'id' | 'status_detail'>;
        await app.audit(updRow.id, 'AI_CLAIM_CREATED', 'AI', 'intake', {
          channel: input.channel,
          decision,
          reason_code: input.reason_code ?? null,
          citation: input.citation ?? null,
          order_id: orderId,
          customer_id: customerId,
          is_defective: input.is_defective,
          via: 'vapi_tool',
          reused_placeholder: true,
        });
        log.info(
          { claim_id: updRow.id, decision, reused: true },
          'reused voice placeholder claim',
        );
        return reply.send({
          claim_id: updRow.id,
          status_detail: updRow.status_detail,
        });
      }
    }

    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .insert({
        customer_id: customerId,
        order_id: orderId,
        channel: input.channel,
        issue: input.issue,
        status_detail: statusDetail,
        decision,
        reason_code: input.reason_code ?? null,
        citation: input.citation ?? null,
        sentiment: input.sentiment ?? null,
        primary_agent_id: decision === 'PROCESSING' ? null : 'rules',
        stage: decision === 'PROCESSING' ? 'verify' : 'rules',
      })
      .select('id, status_detail')
      .single();

    if (claimErr || !claim) {
      log.error({ err: claimErr?.message }, 'claim insert failed');
      return reply.code(500).send({ error: 'claim_insert_failed' });
    }

    const row = claim as Pick<ClaimRow, 'id' | 'status_detail'>;

    // 4. Initial audit event.
    await app.audit(row.id, 'AI_CLAIM_CREATED', 'AI', 'intake', {
      channel: input.channel,
      decision,
      reason_code: input.reason_code ?? null,
      citation: input.citation ?? null,
      order_id: orderId,
      customer_id: customerId,
      is_defective: input.is_defective,
      via: 'vapi_tool',
    });

    log.info({ claim_id: row.id, decision }, 'claim created');
    return reply.send({
      claim_id: row.id,
      status_detail: row.status_detail,
    });
  });
};

export default route;
