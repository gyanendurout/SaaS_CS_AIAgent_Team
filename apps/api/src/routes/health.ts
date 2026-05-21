/**
 * Liveness probe — Railway + uptime checks hit this.
 * No DB call by design: keep it cheap, never block deploys on Supabase health.
 */

import type { FastifyPluginAsync } from 'fastify';

const PKG_VERSION = '0.1.0';

const route: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    version: PKG_VERSION,
    time: new Date().toISOString(),
  }));
};

export default route;
