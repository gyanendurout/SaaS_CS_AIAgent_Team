/**
 * Vapi tool: lookup_order
 *
 * Search by order_number OR customer_email. Returns:
 *   { order, customer, registration | null }
 * or null if nothing found.
 *
 * Schema mirrors packages/vapi-assistant-config/tools/lookup_order.json.
 */

import type { FastifyPluginAsync } from 'fastify';

import { LookupOrderInput } from '../../types/tools.js';
import type { OrderRow, CustomerRow, RegistrationRow } from '../../types/domain.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/lookup_order', async (req, reply) => {
    const parsed = LookupOrderInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ tool: 'lookup_order' });

    let order: OrderRow | null = null;
    let customer: CustomerRow | null = null;
    let registration: RegistrationRow | null = null;

    if (input.order_number) {
      // Search by order number — strip any leading "JL-" prefix the caller spoke.
      const normalised = input.order_number.replace(/^JL[-_ ]?/i, '');
      const { data, error } = await app.supabase
        .from('orders')
        .select('*, customers(*)')
        .or(`order_number.eq.${normalised},order_number.eq.${input.order_number}`)
        .limit(1)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'order lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      if (data) {
        const { customers: cust, ...rest } = data as OrderRow & {
          customers: CustomerRow | null;
        };
        order = rest as OrderRow;
        customer = cust ?? null;
      } else {
        // Fallback: substring/ILIKE match. Lets demo callers say "100001" and
        // hit "JD-100001", or even just the trailing digits. Only kicks in
        // when exact match returns nothing.
        const digits = input.order_number.replace(/\D/g, '');
        const pattern = digits.length >= 3 ? `%${digits}%` : `%${input.order_number}%`;
        const { data: fuzzy, error: fuzzyErr } = await app.supabase
          .from('orders')
          .select('*, customers(*)')
          .ilike('order_number', pattern)
          .order('purchase_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fuzzyErr) {
          log.warn({ err: fuzzyErr.message }, 'order fuzzy lookup soft-failed');
        } else if (fuzzy) {
          const { customers: cust, ...rest } = fuzzy as OrderRow & {
            customers: CustomerRow | null;
          };
          order = rest as OrderRow;
          customer = cust ?? null;
          log.info({ matched: order.order_number, query: input.order_number }, 'fuzzy match hit');
        }
      }
    } else if (input.customer_email) {
      // Find customer first, then most-recent order.
      const { data: c, error: cerr } = await app.supabase
        .from('customers')
        .select('*')
        .ilike('email', input.customer_email)
        .limit(1)
        .maybeSingle();
      if (cerr) {
        log.error({ err: cerr.message }, 'customer lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      customer = (c as CustomerRow | null) ?? null;

      if (customer) {
        const { data: o, error: oerr } = await app.supabase
          .from('orders')
          .select('*')
          .eq('customer_id', customer.id)
          .order('purchase_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (oerr) {
          log.error({ err: oerr.message }, 'order-by-customer lookup failed');
          return reply.code(500).send({ error: 'lookup_failed' });
        }
        order = (o as OrderRow | null) ?? null;
      }
    }

    if (!order && !customer) {
      log.info({ input }, 'lookup_order: no match');
      // Structured "miss" shape so the model can branch on `found:false`
      // instead of having to special-case a bare null body.
      return reply.send({
        found: false,
        order: null,
        customer: null,
        registration: null,
      });
    }

    if (order) {
      const { data: r, error: rerr } = await app.supabase
        .from('registrations')
        .select('*')
        .eq('order_id', order.id)
        .maybeSingle();
      if (rerr) {
        log.warn({ err: rerr.message }, 'registration lookup soft-failed');
      } else {
        registration = (r as RegistrationRow | null) ?? null;
      }
    }

    // Audit — only meaningful if we have a claim context, which we don't yet
    // (Vapi calls this BEFORE create_claim). We log without auditing here; the
    // subsequent create_claim handler audits with the order context.
    log.info(
      { order_id: order?.id ?? null, customer_id: customer?.id ?? null },
      'lookup_order: match',
    );

    return reply.send({
      found: true,
      order,
      customer,
      registration,
    });
  });
};

export default route;
