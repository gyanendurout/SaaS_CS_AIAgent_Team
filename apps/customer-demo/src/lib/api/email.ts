/**
 * POST a customer email into the JOOLA AI backend pipeline.
 *
 * The backend's `/api/customer/email/inbound` endpoint:
 *   1. Inserts an inbound `emails` row
 *   2. Creates or links a `claims` row
 *   3. Kicks off the 7-agent pipeline
 *   4. Eventually inserts an outbound `emails` row (which the inbox UI
 *      picks up via Supabase Realtime).
 */

export type SendEmailPayload = {
  from_addr: string;
  to_addr: string;
  subject: string;
  body: string;
  customer_id: string;
  /** Optional — when present, the backend appends to an existing thread. */
  claim_id?: string;
};

export type SendEmailResponse = {
  email_id: string;
  claim_id: string;
};

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_API_URL');
  return url.replace(/\/+$/, '');
}

export async function sendCustomerEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  const res = await fetch(`${getApiBase()}/api/customer/email/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as SendEmailResponse;
}
