/**
 * POST a customer service web-form submission into the backend pipeline.
 *
 * The backend's `/api/customer/web/inbound` endpoint creates a `claim`
 * + `case_event` and returns the `claim_id` so the UI can subscribe to it.
 * Follow-up messages reuse the same endpoint with a `claim_id`.
 */

export type WebFormPayload = {
  customer_id: string;
  order_number?: string;
  product?: string;
  issue: string;
  urgency?: 'low' | 'normal' | 'high' | 'urgent';
  photos_uploaded?: boolean;
  /** Set when posting a follow-up. */
  claim_id?: string;
};

export type WebFormResponse = {
  claim_id: string;
};

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_API_URL');
  return url.replace(/\/+$/, '');
}

export async function submitWebForm(payload: WebFormPayload): Promise<WebFormResponse> {
  const res = await fetch(`${getApiBase()}/api/customer/web/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Form submit failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as WebFormResponse;
}
