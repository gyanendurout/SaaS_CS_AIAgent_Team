/**
 * Vapi webhook router.
 *
 * Single endpoint receives every server-side event for a call. We:
 *   1. Verify the `x-vapi-secret` (or `x-vapi-signature`) header.
 *   2. Switch on `message.type` and dispatch.
 *   3. Always return 200 quickly — Vapi retries on non-2xx and we never want
 *      a slow handler to stall a live call.
 *
 * For 'function-call', we re-dispatch internally to the matching tool route
 * and return the tool's result so the model can read it on the next turn.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { env } from '../../env.js';
import { shortId } from '../../lib/id-generator.js';
import { verifyVapiSignature } from '../../lib/vapi-signature.js';
import type {
  VapiAnyMessage,
  VapiEndOfCallMessage,
  VapiFunctionCallMessage,
  VapiStatusUpdateMessage,
  VapiTranscriptMessage,
  VapiWebhookEnvelope,
} from '../../types/vapi.js';

/** Local minimal request type to access the parsed body without re-importing types. */
type ReqWithRawBody = FastifyRequest<{ Body: VapiWebhookEnvelope }>;

const route: FastifyPluginAsync = async (app) => {
  // Force raw-body capture for HMAC verification.
  // Fastify exposes the raw body when we register a JSON content parser with
  // `parseAs: 'string'` and call `JSON.parse` ourselves.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        const parsed = body ? JSON.parse(body as string) : {};
        // Stash raw body for downstream handlers (signature check needs it).
        (req as unknown as { rawBody: string }).rawBody = body as string;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post(
    '/webhooks/vapi',
    async (req: ReqWithRawBody, reply) => {
      const corrId = shortId('vapi');
      const log = req.log.child({ corrId, route: '/webhooks/vapi' });

      const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? '';
      const sigHeader =
        (req.headers['x-vapi-secret'] as string | undefined) ??
        (req.headers['x-vapi-signature'] as string | undefined);

      const verify = verifyVapiSignature(rawBody, sigHeader, env.VAPI_WEBHOOK_SECRET);
      if (!verify.ok) {
        log.warn({ mode: verify.mode }, '[vapi] signature verification failed');
        return reply.code(401).send({ error: 'invalid_signature' });
      }

      const envelope = req.body;
      const message = envelope?.message;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        log.warn({ body: rawBody.slice(0, 200) }, '[vapi] missing message envelope');
        return reply.code(400).send({ error: 'bad_envelope' });
      }

      log.info({ type: message.type }, '[vapi] event received');

      try {
        switch (message.type) {
          case 'transcript':
            await handleTranscript(app, message as VapiTranscriptMessage, log);
            return reply.send({ ok: true });

          case 'function-call':
          case 'tool-calls': {
            const result = await handleFunctionCall(
              app,
              message as VapiFunctionCallMessage,
              log,
            );
            return reply.send(result);
          }

          case 'end-of-call-report':
            await handleEndOfCall(app, message as VapiEndOfCallMessage, log);
            return reply.send({ ok: true });

          case 'status-update':
            log.info(
              { status: (message as VapiStatusUpdateMessage).status },
              '[vapi] status',
            );
            return reply.send({ ok: true });

          default:
            log.info({ type: message.type }, '[vapi] unhandled type — ack');
            return reply.send({ ok: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err: msg, type: message.type }, '[vapi] handler threw');
        // 200 with error payload — Vapi shouldn't retry a logic error.
        return reply.send({ ok: false, error: msg });
      }
    },
  );
};

export default route;

// =============================================================================
// Handlers
// =============================================================================

async function handleTranscript(
  app: import('fastify').FastifyInstance,
  msg: VapiTranscriptMessage,
  log: import('fastify').FastifyBaseLogger,
): Promise<void> {
  // Skip partials — only persist finals to keep transcripts table tidy.
  if (msg.transcriptType && msg.transcriptType !== 'final') return;

  const claimId = msg.call?.metadata?.claim_id;
  if (!claimId) {
    log.debug('[vapi:transcript] no claim_id in metadata — skipping persistence');
    return;
  }

  const text = msg.transcript?.trim();
  if (!text) return;

  // Look up next line_index for this claim.
  const { data: maxRow } = await app.supabase
    .from('transcripts')
    .select('line_index')
    .eq('claim_id', claimId)
    .order('line_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (maxRow?.line_index ?? -1) + 1;
  const who: 'CUSTOMER' | 'AI' = msg.role === 'assistant' ? 'AI' : 'CUSTOMER';

  const { error } = await app.supabase.from('transcripts').insert({
    claim_id: claimId,
    line_index: nextIndex,
    who,
    txt: text,
  });
  if (error) {
    log.error({ err: error.message, claimId }, '[vapi:transcript] insert failed');
  }
}

async function handleEndOfCall(
  app: import('fastify').FastifyInstance,
  msg: VapiEndOfCallMessage,
  log: import('fastify').FastifyBaseLogger,
): Promise<void> {
  const claimId = msg.call?.metadata?.claim_id as string | undefined;

  if (claimId) {
    // Call resulted in a claim — log normal end event.
    await app.audit(claimId, 'AI_CALL_ENDED', 'AI', 'response', {
      ended_reason: msg.endedReason ?? null,
      duration_seconds: msg.durationSeconds ?? null,
      cost: msg.cost ?? null,
      recording_url: msg.recordingUrl ?? null,
      summary: msg.summary ?? null,
    });
    return;
  }

  // No claim was created during the call.
  // Determine if this qualifies as a missed / unresolved call that should get
  // an automatic email follow-up from the AI CS agent.
  const MISSED_REASONS = new Set([
    'customer-did-not-answer',
    'no-answer',
    'voicemail',
    'customer-busy',
    'exceeded-max-duration',
  ]);
  const isMissed =
    MISSED_REASONS.has(msg.endedReason ?? '') ||
    (typeof msg.durationSeconds === 'number' && msg.durationSeconds < 15);

  if (!isMissed) {
    log.info({ endedReason: msg.endedReason }, '[vapi:end-of-call] no claim, not a missed call — skipping');
    return;
  }

  // Resolve the caller identity from the call object.
  const callerPhone = msg.call?.customer?.number ?? null;
  const callerEmail = msg.call?.customer?.email ?? null;
  const callerName = msg.call?.customer?.name ?? null;

  if (!callerPhone && !callerEmail) {
    log.warn('[vapi:end-of-call] missed call but no phone/email — cannot create follow-up');
    return;
  }

  log.info(
    { callerPhone, callerEmail, endedReason: msg.endedReason },
    '[vapi:end-of-call] missed call — creating email follow-up',
  );

  try {
    // Look up or create the customer.
    let customerId: string | null = null;

    if (callerEmail) {
      const { data: byEmail } = await app.supabase
        .from('customers')
        .select('id')
        .ilike('email', callerEmail)
        .limit(1)
        .maybeSingle();
      customerId = (byEmail as { id: string } | null)?.id ?? null;
    }

    if (!customerId && callerPhone) {
      const { data: byPhone } = await app.supabase
        .from('customers')
        .select('id')
        .eq('phone', callerPhone)
        .limit(1)
        .maybeSingle();
      customerId = (byPhone as { id: string } | null)?.id ?? null;
    }

    if (!customerId) {
      // Create a minimal customer record from the caller info.
      const { data: created } = await app.supabase
        .from('customers')
        .insert({
          email: callerEmail ?? `${callerPhone}@unknown.joola.com`,
          name: callerName ?? callerPhone ?? 'Unknown caller',
          phone: callerPhone ?? null,
        })
        .select('id')
        .single();
      customerId = (created as { id: string } | null)?.id ?? null;
    }

    if (!customerId) {
      log.error('[vapi:end-of-call] could not resolve or create customer — aborting follow-up');
      return;
    }

    // Create the follow-up claim on the email channel so the AI pipeline
    // drafts a "we missed your call" outreach email.
    const issue = `Missed call follow-up — customer called but the call did not connect (${msg.endedReason ?? 'no-answer'}). Please reach out via email.`;
    const { data: newClaim } = await app.supabase
      .from('claims')
      .insert({
        customer_id: customerId,
        channel: 'email',
        issue,
        status_detail: 'NEW',
        stage: 'intake',
      })
      .select('id')
      .single();

    const followUpClaimId = (newClaim as { id: string } | null)?.id;
    if (!followUpClaimId) {
      log.error('[vapi:end-of-call] claim insert failed — no id returned');
      return;
    }

    await app.audit(followUpClaimId, 'MISSED_CALL_FOLLOWUP', 'AI', 'intake', {
      caller_phone: callerPhone,
      caller_email: callerEmail,
      ended_reason: msg.endedReason ?? null,
      duration_seconds: msg.durationSeconds ?? null,
      vapi_call_id: msg.call?.id ?? null,
    });

    // Run the AI pipeline so the response agent drafts the follow-up email.
    // The draft will sit in pending_approval for CS to review before sending.
    try {
      await app.aiAgents.runPipeline({
        claim_id: followUpClaimId,
        channel: 'email',
        raw_input: {
          issue,
          customer_email: callerEmail ?? '',
          missed_call: true,
        },
      });
      log.info({ claimId: followUpClaimId }, '[vapi:end-of-call] missed-call pipeline complete');
    } catch (pipeErr) {
      log.error(
        { err: pipeErr instanceof Error ? pipeErr.message : String(pipeErr), claimId: followUpClaimId },
        '[vapi:end-of-call] missed-call pipeline failed — claim still queued',
      );
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      '[vapi:end-of-call] missed-call follow-up threw',
    );
  }
}

/**
 * Re-dispatch a Vapi `function-call` to the matching internal tool route via
 * `app.inject()`. Returns the Vapi-expected `{ result }` envelope.
 *
 * Why inject rather than calling a shared function? Because the tool routes
 * are HTTP-shaped (validated by Zod) — keeping them as the single source of
 * truth means external callers (Vapi, tests, ngrok manual hits) and the
 * internal dispatcher behave identically.
 */
async function handleFunctionCall(
  app: import('fastify').FastifyInstance,
  msg: VapiFunctionCallMessage,
  log: import('fastify').FastifyBaseLogger,
): Promise<{ result: unknown }> {
  // Normalise: function-call vs tool-calls payloads
  const call =
    msg.functionCall ??
    msg.toolCallList?.[0]?.function ??
    undefined;

  if (!call?.name) {
    log.warn('[vapi:function-call] missing call.name');
    return { result: { error: 'missing_function_name' } };
  }

  // `parameters` is the modern shape; `arguments` is a stringified fallback.
  let params: Record<string, unknown> = {};
  if (call.parameters && typeof call.parameters === 'object') {
    params = call.parameters;
  } else if (typeof call.arguments === 'string') {
    try {
      params = JSON.parse(call.arguments);
    } catch {
      log.warn('[vapi:function-call] arguments not JSON — passing empty');
    }
  }

  const path = TOOL_PATHS[call.name];
  if (!path) {
    log.warn({ name: call.name }, '[vapi:function-call] unknown tool');
    return { result: { error: `unknown_tool:${call.name}` } };
  }

  // Inject the request — preserves all plugins/decorators on the inner request.
  const resp = await app.inject({
    method: 'POST',
    url: path,
    payload: params,
    headers: { 'content-type': 'application/json' },
  });

  let payload: unknown = resp.body;
  try {
    payload = JSON.parse(resp.body);
  } catch {
    /* leave as text */
  }

  if (resp.statusCode >= 400) {
    log.warn({ tool: call.name, status: resp.statusCode }, '[vapi:function-call] tool error');
  }

  return { result: payload };
}

const TOOL_PATHS: Record<string, string> = {
  lookup_order: '/api/tools/lookup_order',
  check_warranty_registration: '/api/tools/check_warranty_registration',
  evaluate_eligibility: '/api/tools/evaluate_eligibility',
  create_claim: '/api/tools/create_claim',
  escalate_to_human: '/api/tools/escalate_to_human',
};
