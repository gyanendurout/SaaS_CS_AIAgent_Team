/**
 * Vapi tool: get_order_status
 *
 * Live order status from Shopify (Team JOOLA sandbox, via ai-agents): payment
 * and fulfilment status, items, carrier + tracking, returns. The caller must
 * give the email or postcode on the order; a mismatch answers `not_found`.
 * No personal data (email, address, phone) is ever returned.
 *
 * Never fails the call: if ai-agents is unreachable or ORDER_SOURCE=off it
 * returns { enabled: false, status: 'disabled' | 'unavailable', order: null }.
 */

import type { FastifyPluginAsync } from 'fastify';

import { UpstreamError } from '../../lib/errors.js';
import { GetOrderStatusInput } from '../../types/tools.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/get_order_status', async (req, reply) => {
    const parsed = GetOrderStatusInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const log = req.log.child({ tool: 'get_order_status' });

    try {
      const result = await app.aiAgents.getOrderStatus(parsed.data);
      // Log the outcome only — never the email/postcode the caller gave.
      log.info({ enabled: result.enabled, status: result.status }, 'get_order_status');
      return reply.send(result);
    } catch (err) {
      if (err instanceof UpstreamError) {
        log.warn({ err: err.message }, 'order upstream unavailable — degrading');
        return reply.send({ enabled: false, status: 'unavailable', order: null });
      }
      throw err;
    }
  });
};

export default route;
