/**
 * Vapi tool: search_products
 *
 * Live JOOLA catalogue lookup (Shopify Storefront via ai-agents): price, sale
 * price, overall and per-variant stock, product link — for a named product.
 *
 * Never fails the call: if ai-agents is unreachable, or the catalogue is
 * switched off (CATALOG_SOURCE=off), it returns { enabled: false, results: [] }
 * and the assistant says it can't check live stock right now.
 *
 * Returns: { enabled, results: [{ title, url, price, compare_at_price, on_sale, available, variants }] }
 */

import type { FastifyPluginAsync } from 'fastify';

import { UpstreamError } from '../../lib/errors.js';
import { SearchProductsInput } from '../../types/tools.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/search_products', async (req, reply) => {
    const parsed = SearchProductsInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const log = req.log.child({ tool: 'search_products' });

    try {
      const result = await app.aiAgents.searchProducts(parsed.data.query);
      log.info({ enabled: result.enabled, hits: result.results.length }, 'search_products');
      return reply.send(result);
    } catch (err) {
      if (err instanceof UpstreamError) {
        log.warn({ err: err.message }, 'catalogue upstream unavailable — degrading');
        return reply.send({ enabled: false, results: [], error: 'upstream_unavailable' });
      }
      throw err;
    }
  });
};

export default route;
