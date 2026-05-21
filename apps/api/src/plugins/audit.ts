/**
 * Audit plugin — decorates Fastify with `app.audit(...)` for writing rows to
 * `case_events`. Every meaningful endpoint MUST call this at least once.
 *
 * We swallow + log errors here rather than rethrowing: audit failure should
 * never break a customer-facing request, but it must be loud in logs so we
 * can backfill if it ever happens.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../env.js';
import type { ActorType } from '../types/domain.js';

export type AuditFn = (
  claimId: string,
  eventType: string,
  actorType: ActorType,
  actorId: string | null,
  payload?: Record<string, unknown>,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditFn;
  }
}

const auditPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const audit: AuditFn = async (claimId, eventType, actorType, actorId, payload = {}) => {
    if (!claimId) {
      app.log.warn({ eventType, actorType }, '[audit] missing claimId — skipped');
      return;
    }
    const { error } = await app.supabase.from('case_events').insert({
      claim_id: claimId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId,
      payload,
      policy_version: env.POLICY_VERSION,
    });
    if (error) {
      // Log loud but do not throw — never let audit failure break a request.
      app.log.error(
        { claimId, eventType, actorType, actorId, err: error.message },
        '[audit] insert failed',
      );
      return;
    }
    app.log.debug({ claimId, eventType, actorType, actorId }, '[audit] written');
  };

  app.decorate('audit', audit);
};

export default fp(auditPlugin, { name: 'audit', dependencies: ['supabase'] });
