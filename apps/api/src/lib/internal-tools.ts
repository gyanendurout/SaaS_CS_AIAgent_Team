/**
 * Guard for /api/tools/* — these routes return customer data (lookup_order) and
 * are only meant to be reached through the signed Vapi webhook, which calls
 * them in-process with `app.inject()`.
 *
 * A random token is generated per process at boot; the webhook adds it as a
 * header on its inject calls. Requests from outside can't know it, so they get
 * 403 (QA 2026-11-14: the routes were open to the internet).
 *
 * Escape hatch for local manual testing only: TOOL_ROUTES_OPEN=true.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

export const INTERNAL_TOOL_HEADER = 'x-internal-tool-call';
export const INTERNAL_TOOL_TOKEN = randomBytes(32).toString('hex');

function sameToken(given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(INTERNAL_TOOL_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isToolRoute(url: string): boolean {
  return url.startsWith('/api/tools/');
}

export function toolRoutesOpen(): boolean {
  return process.env['TOOL_ROUTES_OPEN'] === 'true';
}

export async function requireInternalToolCall(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isToolRoute(req.url) || toolRoutesOpen()) return;
  const given = req.headers[INTERNAL_TOOL_HEADER];
  if (typeof given === 'string' && sameToken(given)) return;
  req.log.warn({ url: req.url }, '[tools] direct call refused (not via Vapi webhook)');
  await reply.code(403).send({ error: 'forbidden' });
}
