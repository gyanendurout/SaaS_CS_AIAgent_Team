/**
 * Vapi Web SDK loader.
 *
 * The Vapi SDK is browser-only (uses WebRTC + getUserMedia). We dynamically
 * import it from the call page so it never accidentally lands in the
 * server bundle for the email/web routes.
 *
 * The "public key" is different from the secret Vapi API key — it is the
 * front-end-safe key generated alongside the assistant in the Vapi dashboard.
 */

import type { VapiCallContext } from './types';

let cachedClientPromise: Promise<unknown> | null = null;

export function getVapiPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_VAPI_PUBLIC_KEY');
  return key;
}

export function getVapiAssistantId(): string {
  const id = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  if (!id) throw new Error('Missing NEXT_PUBLIC_VAPI_ASSISTANT_ID');
  return id;
}

/**
 * Lazy-load the Vapi SDK and instantiate a client. Cached for the page lifetime.
 * Returns `unknown` because the SDK's own constructor signature evolves; the
 * consumer narrows it locally with a small interface.
 */
export async function loadVapiClient(): Promise<unknown> {
  if (cachedClientPromise) return cachedClientPromise;

  cachedClientPromise = (async () => {
    const mod = await import('@vapi-ai/web');
    const Vapi = (mod as { default?: unknown }).default ?? mod;
    const VapiCtor = Vapi as new (publicKey: string) => unknown;
    return new VapiCtor(getVapiPublicKey());
  })();

  return cachedClientPromise;
}

/** Build the `assistantOverrides` payload passed into vapi.start().
 *  - variableValues: substituted into the assistant's system prompt
 *  - metadata: echoed back on every server webhook event (transcript, end-of-call)
 *    so our backend can persist transcript lines to the correct claim row.
 */
export function buildAssistantOverrides(ctx: VapiCallContext, claimId?: string) {
  return {
    variableValues: {
      customer_id: ctx.customer_id,
      customer_name: ctx.customer_name,
      customer_email: ctx.customer_email,
    },
    metadata: {
      claim_id: claimId ?? null,
      customer_id: ctx.customer_id,
      customer_email: ctx.customer_email,
    },
  } as const;
}
