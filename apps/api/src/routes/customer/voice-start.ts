/**
 * POST /api/customer/voice/start
 *
 * Optional hint endpoint for the customer demo. The Vapi web SDK starts the
 * call directly browser→Vapi, but we let the demo POST here first so we can
 * pre-create an empty claim row and hand back its WC-XXXXX id. The demo then
 * passes that id into Vapi's `assistantOverrides.metadata.claim_id`, so
 * subsequent webhook events (transcript, end-of-call) can be persisted.
 *
 * Body: { customer_id?: uuid, customer_email?: string, customer_name?: string }
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ClaimRow, CustomerRow } from '../../types/domain.js';

const Body = z
  .object({
    customer_id: z.string().uuid().optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.customer_id || d.customer_email), {
    message: 'Provide customer_id or customer_email',
  });

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/customer/voice/start', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ route: 'customer/voice/start' });

    // Resolve / create customer.
    let customerId = input.customer_id ?? null;
    if (!customerId) {
      const { data, error } = await app.supabase
        .from('customers')
        .select('id')
        .ilike('email', input.customer_email!)
        .limit(1)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'customer lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      if (data) {
        customerId = (data as Pick<CustomerRow, 'id'>).id;
      } else {
        const { data: created, error: insErr } = await app.supabase
          .from('customers')
          .insert({
            email: input.customer_email!,
            name: input.customer_name ?? input.customer_email!.split('@')[0]!,
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

    // Pre-create an empty voice claim — the model will fill in issue + decision later.
    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .insert({
        customer_id: customerId,
        channel: 'voice',
        issue: '(voice call in progress)',
        status_detail: 'NEW',
        stage: 'intake',
      })
      .select('id')
      .single();

    if (claimErr || !claim) {
      log.error({ err: claimErr?.message }, 'claim insert failed');
      return reply.code(500).send({ error: 'claim_insert_failed' });
    }

    const row = claim as Pick<ClaimRow, 'id'>;
    await app.audit(row.id, 'CUST_VOICE_STARTED', 'CUSTOMER', customerId, {
      channel: 'voice',
    });

    return reply.send({ claim_id: row.id, customer_id: customerId });
  });
};

export default route;
