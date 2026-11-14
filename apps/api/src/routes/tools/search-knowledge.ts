/**
 * Vapi tool: search_knowledge
 *
 * Forwards the caller's question to the ai-agents shared memory
 * (pgvector `kb_chunks`) and returns the best-matching snippets.
 *
 * Never fails the call: if ai-agents is unreachable, or memory is switched
 * off (KNOWLEDGE_SOURCE=static), it returns { enabled: false, results: [] } and
 * the assistant answers from its built-in knowledge as before.
 *
 * Returns: { enabled, results: [{ source, heading, content, score }] }
 */

import type { FastifyPluginAsync } from 'fastify';

import { UpstreamError } from '../../lib/errors.js';
import { SearchKnowledgeInput } from '../../types/tools.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/search_knowledge', async (req, reply) => {
    const parsed = SearchKnowledgeInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const log = req.log.child({ tool: 'search_knowledge' });

    try {
      const result = await app.aiAgents.searchKnowledge(parsed.data.query);
      log.info(
        { enabled: result.enabled, hits: result.results.length },
        'search_knowledge',
      );
      return reply.send(result);
    } catch (err) {
      if (err instanceof UpstreamError) {
        log.warn({ err: err.message }, 'knowledge upstream unavailable — degrading');
        return reply.send({ enabled: false, results: [], error: 'upstream_unavailable' });
      }
      throw err;
    }
  });
};

export default route;
