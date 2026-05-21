/**
 * HMAC-SHA256 verification for Vapi webhook signatures.
 *
 * Vapi signs the raw request body with a shared secret (configured per server URL
 * in their dashboard) and sends the hex digest in the `x-vapi-secret` header
 * (a.k.a. `x-vapi-signature` on some workspaces — accept either).
 *
 * We compare with `timingSafeEqual` to avoid leaking signature differences.
 *
 * NOTE: For local dev / demo without webhook signing wired up, we accept a
 * literal shared-secret match too (Vapi historically sent the secret in plain
 * in `x-vapi-secret`). Both paths are constant-time-compared.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyResult {
  ok: boolean;
  mode: 'hmac' | 'literal' | 'missing' | 'mismatch';
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a Vapi webhook signature.
 *
 * @param rawBody   The raw request body bytes (string form).
 * @param signature The header value (`x-vapi-secret` / `x-vapi-signature`).
 * @param secret    The shared secret from env.VAPI_WEBHOOK_SECRET.
 */
export function verifyVapiSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): VerifyResult {
  if (!signature || !secret) {
    return { ok: false, mode: 'missing' };
  }

  // Path 1: header is the HMAC-SHA256 hex digest of the body.
  const expectedHmac = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (safeEqualHex(signature, expectedHmac)) {
    return { ok: true, mode: 'hmac' };
  }

  // Path 2: header literally equals the shared secret (Vapi's simpler mode).
  if (safeEqualUtf8(signature, secret)) {
    return { ok: true, mode: 'literal' };
  }

  return { ok: false, mode: 'mismatch' };
}
