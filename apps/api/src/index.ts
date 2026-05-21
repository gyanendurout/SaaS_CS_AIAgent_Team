/**
 * Fastify server bootstrap.
 *
 * - Loads + validates env (env.ts throws on import if anything is missing)
 * - Registers core plugins (sensible, cors, supabase, ai-agents, audit)
 * - Mounts all routes
 * - Sets a global error handler that converts DomainError subclasses to JSON
 * - Wires graceful shutdown on SIGINT/SIGTERM
 */

import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './env.js';
import {
  DomainError,
  ExportTooLargeError,
  NotFoundError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from './lib/errors.js';

import aiAgentsPlugin from './plugins/ai-agents.js';
import auditPlugin from './plugins/audit.js';
import corsPlugin from './plugins/cors.js';
import supabasePlugin from './plugins/supabase.js';

// Routes
import healthRoute from './routes/health.js';
import archiveExportRoute from './routes/archive/export.js';
import approveDraftRoute from './routes/cases/approve-draft.js';
import escalateRoute from './routes/cases/escalate.js';
import reopenRoute from './routes/cases/reopen.js';
import sendAwaitReplyRoute from './routes/cases/send-await-reply.js';
import emailInboundRoute from './routes/customer/email-inbound.js';
import voiceStartRoute from './routes/customer/voice-start.js';
import webInboundRoute from './routes/customer/web-inbound.js';
import checkRegRoute from './routes/tools/check-warranty-registration.js';
import createClaimRoute from './routes/tools/create-claim.js';
import escalateToHumanRoute from './routes/tools/escalate-to-human.js';
import evaluateRoute from './routes/tools/evaluate-eligibility.js';
import lookupOrderRoute from './routes/tools/lookup-order.js';
import vapiWebhookRoute from './routes/webhooks/vapi.js';

async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
                singleLine: false,
              },
            },
          }
        : {}),
    },
    // Trust X-Forwarded-* headers when behind Railway/ngrok.
    trustProxy: true,
    // Reject payloads larger than 1MB by default — Vapi events are tiny.
    bodyLimit: 1_048_576,
  });

  // ---- Plugins (order matters: supabase before audit) -------------------
  await app.register(sensible);
  await app.register(corsPlugin);
  await app.register(supabasePlugin);
  await app.register(aiAgentsPlugin);
  await app.register(auditPlugin);

  // ---- Routes ----------------------------------------------------------
  await app.register(healthRoute);

  // Vapi webhook (raw body capture lives in this route file)
  await app.register(vapiWebhookRoute);

  // Vapi tool endpoints
  await app.register(lookupOrderRoute);
  await app.register(checkRegRoute);
  await app.register(evaluateRoute);
  await app.register(createClaimRoute);
  await app.register(escalateToHumanRoute);

  // Customer demo
  await app.register(voiceStartRoute);
  await app.register(emailInboundRoute);
  await app.register(webInboundRoute);

  // Case lifecycle
  await app.register(reopenRoute);
  await app.register(approveDraftRoute);
  await app.register(sendAwaitReplyRoute);
  await app.register(escalateRoute);

  // Archive
  await app.register(archiveExportRoute);

  // ---- Error handler ----------------------------------------------------
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotFoundError) {
      req.log.warn({ err: err.message }, 'NotFoundError');
      return reply.code(404).send({ error: err.code, message: err.message });
    }
    if (err instanceof ValidationError) {
      req.log.warn({ err: err.message }, 'ValidationError');
      return reply
        .code(400)
        .send({ error: err.code, message: err.message, details: (err as ValidationError).details });
    }
    if (err instanceof RateLimitError) {
      if ((err as RateLimitError).retryAfterSeconds) {
        reply.header('Retry-After', String((err as RateLimitError).retryAfterSeconds));
      }
      return reply.code(429).send({ error: err.code, message: err.message });
    }
    if (err instanceof ExportTooLargeError) {
      return reply
        .code(416)
        .send({ error: err.code, message: err.message, count: (err as ExportTooLargeError).count });
    }
    if (err instanceof UpstreamError) {
      req.log.error({ err: err.message }, 'UpstreamError');
      return reply.code(502).send({ error: err.code, message: err.message });
    }
    if (err instanceof DomainError) {
      req.log.error({ err: err.message, code: err.code }, 'DomainError');
      return reply.code(500).send({ error: err.code, message: err.message });
    }
    // Fastify built-in errors with a statusCode
    if (typeof err.statusCode === 'number') {
      return reply
        .code(err.statusCode)
        .send({ error: err.name, message: err.message });
    }
    req.log.error({ err: err.message, stack: err.stack }, 'unhandled error');
    return reply.code(500).send({ error: 'internal_error' });
  });

  // 404 fallback
  app.setNotFoundHandler((req, reply) => {
    req.log.info({ url: req.url, method: req.method }, '404');
    return reply.code(404).send({
      error: 'not_found',
      message: `${req.method} ${req.url} is not a route`,
    });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        publicUrl: env.PUBLIC_BACKEND_URL ?? `http://localhost:${env.PORT}`,
        policyVersion: env.POLICY_VERSION,
      },
      '[boot] joola-api listening',
    );
  } catch (err) {
    app.log.fatal({ err: (err as Error).message }, '[boot] listen failed');
    process.exit(1);
  }

  const shutdown = (signal: string) => {
    app.log.info({ signal }, '[shutdown] closing server…');
    app
      .close()
      .then(() => {
        app.log.info('[shutdown] closed cleanly');
        process.exit(0);
      })
      .catch((err: unknown) => {
        app.log.error({ err: (err as Error).message }, '[shutdown] error');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'unhandledRejection');
  });
}

void start();
