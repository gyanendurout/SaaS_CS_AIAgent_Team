/**
 * Supabase plugin — decorates the Fastify instance with a service-role client.
 *
 * Bypasses RLS by design (we use the `SUPABASE_SECRET_KEY`). We control access
 * in route handlers + Zod validation. Never expose this client to the browser.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../env.js';

// `any` for Database generic — we don't have generated types yet and most
// callers use `.from('table')` strings. Keep us honest with explicit row types
// imported from `types/domain.ts` at call sites.
export type ServiceClient = SupabaseClient;

declare module 'fastify' {
  interface FastifyInstance {
    supabase: ServiceClient;
  }
}

const supabasePlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: 'public' },
    global: {
      headers: { 'x-application-name': 'joola-api' },
    },
  });

  app.decorate('supabase', client);
  app.log.info('[supabase] service-role client initialised');
};

// Wrap in fastify-plugin so the decorator survives outside the registering scope.
// We dynamically import fastify-plugin to keep the dependency optional — but
// to stay simple and correct, declare it as a regular dep at install time.
export default fp(supabasePlugin, { name: 'supabase' });
