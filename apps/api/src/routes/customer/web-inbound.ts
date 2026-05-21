/**
 * POST /api/customer/web/inbound
 *
 * Customer-demo web-form submission. Creates a claim and kicks off the
 * Python AI pipeline.
 *
 * Body: { customer_id?, customer_email, customer_name?, order_number?,
 *         product?, issue, urgency? }
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ClaimRow, CustomerRow, OrderRow } from '../../types/domain.js';

const Body = z
  .object({
    customer_id: z.string().uuid().optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().min(1).optional(),
    order_number: z.string().min(1).optional(),
    product: z.string().min(1).optional(),
    issue: z.string().min(5, 'issue must be at least 5 characters'),
    urgency: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  })
  .refine((d) => Boolean(d.customer_id || d.customer_email), {
    message: 'Provide customer_id or customer_email',
  });

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/customer/web/inbound', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ route: 'customer/web/inbound' });

    // 1. Resolve / create customer.
    let customerId = input.customer_id ?? null;
    if (!customerId) {
      const { data: existing, error } = await app.supabase
        .from('customers')
        .select('id')
        .ilike('email', input.customer_email!)
        .limit(1)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'customer lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      if (existing) {
        customerId = (existing as Pick<CustomerRow, 'id'>).id;
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

    // 2. Resolve optional order.
    let orderId: string | null = null;
    if (input.order_number) {
      const normalised = input.order_number.replace(/^JL[-_ ]?/i, '');
      const { data } = await app.supabase
        .from('orders')
        .select('id')
        .or(`order_number.eq.${normalised},order_number.eq.${input.order_number}`)
        .limit(1)
        .maybeSingle();
      orderId = (data as Pick<OrderRow, 'id'> | null)?.id ?? null;
    }

    // 3. Create the claim.
    const { data: claim, error: claimErr } = await app.supabase
      .from('claims')
      .insert({
        customer_id: customerId,
        order_id: orderId,
        channel: 'web',
        issue: input.issue,
        status_detail: 'NEW',
        stage: 'intake',
      })
      .select('id')
      .single();
    if (claimErr || !claim) {
      log.error({ err: claimErr?.message }, 'claim insert failed');
      return reply.code(500).send({ error: 'claim_insert_failed' });
    }
    const claimId = (claim as Pick<ClaimRow, 'id'>).id;

    await app.audit(claimId, 'CUST_WEB_SUBMITTED', 'CUSTOMER', customerId, {
      product: input.product ?? null,
      urgency: input.urgency,
      order_number: input.order_number ?? null,
    });

    // 4. Fire pipeline (best-effort). raw_input carries the form fields so
    //    the response drafter can reference the customer's actual description
    //    (the LLM otherwise sees an empty `issue_as_reported`).
    try {
      const pipeline = await app.aiAgents.runPipeline({
        claim_id: claimId,
        channel: 'web',
        raw_input: {
          issue: input.issue,
          customer_email: input.customer_email,
          order_number: input.order_number ?? undefined,
          product: input.product ?? undefined,
        },
      });
      log.info({ claim_id: claimId, decision: pipeline.decision }, 'pipeline complete');
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err), claim_id: claimId },
        'pipeline failed — claim still queued',
      );
    }

    return reply.send({ claim_id: claimId, status: 'received' });
  });
};

export default route;
