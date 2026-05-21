/**
 * CORS plugin — allow the configured dashboard + customer-demo origins,
 * plus all *.vercel.app preview deployments.
 *
 * Origin matching:
 *   - Exact match against CORS_ORIGINS (env, comma-separated)
 *   - Any host ending in `.vercel.app`
 *   - Same-origin / server-to-server requests (no Origin header) → allowed
 */

import fastifyCors from '@fastify/cors';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { corsOrigins } from '../env.js';

const corsPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const allowSet = new Set(corsOrigins);

  await app.register(fastifyCors, {
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-vapi-secret', 'x-vapi-signature'],
    origin: (origin, cb) => {
      // No origin header = same-origin or server-to-server (curl, Vapi). Allow.
      if (!origin) return cb(null, true);
      if (allowSet.has(origin)) return cb(null, true);

      try {
        const host = new URL(origin).hostname;
        if (host.endsWith('.vercel.app')) return cb(null, true);
      } catch {
        /* malformed origin — fall through to deny */
      }

      app.log.warn({ origin }, '[cors] denied origin');
      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
  });

  app.log.info({ allowed: corsOrigins }, '[cors] registered');
};

export default fp(corsPlugin, { name: 'cors' });
