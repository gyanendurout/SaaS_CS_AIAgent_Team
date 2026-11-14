/**
 * GET /api/customer/live_orders?limit=10
 *
 * Newest orders from the Team JOOLA Shopify **sandbox** for the customer-demo
 * "Order status — live Shopify" cards (via ai-agents /tools/live_orders).
 * Status-only: number, date, payment/fulfilment status, items, tracking,
 * returns, and an email hint (full only for ORDER_SAMPLE_EMAIL_DOMAINS,
 * otherwise masked). Never addresses or postcodes.
 *
 * Never fails the page: upstream problems return { enabled:false, orders:[] }.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { UpstreamError } from '../../lib/errors.js';

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

const route: FastifyPluginAsync = async (app) => {
  app.get('/api/customer/live_orders', async (req, reply) => {
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }
    const log = req.log.child({ route: 'live_orders' });
    try {
      const result = await app.aiAgents.listLiveOrders(parsed.data.limit);
      log.info({ enabled: result.enabled, count: result.orders.length }, 'live_orders');
      return reply.send(result);
    } catch (err) {
      if (err instanceof UpstreamError) {
        log.warn({ err: err.message }, 'live orders upstream unavailable — degrading');
        return reply.send({ enabled: false, orders: [], error: 'upstream_unavailable' });
      }
      throw err;
    }
  });
};

export default route;
