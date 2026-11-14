/**
 * Newest orders from the Team JOOLA Shopify sandbox, for the demo's
 * "Order status — live Shopify" cards (GET /api/customer/live_orders).
 * Status-only data; `email_hint` is masked unless its domain is allow-listed.
 */

export type LiveOrder = {
  order_number: string | null;
  placed_on: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  cancelled: boolean;
  items: { title: string | null; quantity: number | null }[];
  shipments: {
    status: string | null;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
  }[];
  returns: { name: string | null; status: string | null }[];
  email_hint: string | null;
};

export type LiveOrdersResponse = {
  enabled: boolean;
  orders: LiveOrder[];
  error?: string | null;
};

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_API_URL');
  return url.replace(/\/+$/, '');
}

export async function fetchLiveOrders(limit = 9, signal?: AbortSignal): Promise<LiveOrdersResponse> {
  const res = await fetch(`${getApiBase()}/api/customer/live_orders?limit=${limit}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`Live orders failed (${res.status})`);
  return (await res.json()) as LiveOrdersResponse;
}

/** A masked hint contains "***" — it can't be spoken on a call. */
export function isFullEmail(hint: string | null): hint is string {
  return !!hint && !hint.includes('***');
}
