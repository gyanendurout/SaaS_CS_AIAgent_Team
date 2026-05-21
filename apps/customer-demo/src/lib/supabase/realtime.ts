/**
 * Realtime helpers for the customer-demo app.
 *
 * Important: this app subscribes to a *narrow* slice of tables — only
 * `emails` (filtered to the current customer's address) and `claims`
 * (filtered to a specific claim id while the web-form case-status card is
 * mounted). It must NOT subscribe to dashboard tables like `agent_states`
 * or `escalations` — those are dashboard concerns.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type EmailRow = {
  id: string;
  claim_id: string;
  direction: 'inbound' | 'outbound';
  from_addr: string;
  to_addr: string;
  subject: string;
  body: string;
  sent_at: string | null;
  created_at: string;
};

export type ClaimRow = {
  id: string;
  customer_id: string;
  channel: 'voice' | 'email' | 'web';
  issue: string;
  status_detail: string;
  display_status: 'OPEN' | 'CLOSED' | 'REOPENED';
  decision: string;
  reason_code: string | null;
  citation: string | null;
  stage: string;
  created_at: string;
  closed_at: string | null;
};

/**
 * Subscribe to all email rows where the customer is either sender or recipient.
 * We can't OR-filter in a single channel filter, so we open two parallel
 * subscriptions and dedupe by id on the consumer side.
 */
export function subscribeCustomerEmails(
  client: SupabaseClient,
  customerEmail: string,
  onInsert: (row: EmailRow) => void,
): RealtimeChannel[] {
  const safe = customerEmail.replace(/'/g, "''");

  const toChannel = client
    .channel(`emails-to-${safe}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emails', filter: `to_addr=eq.${safe}` },
      (payload) => onInsert(payload.new as EmailRow),
    )
    .subscribe();

  const fromChannel = client
    .channel(`emails-from-${safe}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emails', filter: `from_addr=eq.${safe}` },
      (payload) => onInsert(payload.new as EmailRow),
    )
    .subscribe();

  return [toChannel, fromChannel];
}

/** Subscribe to UPDATEs on a single claim row (for the web case-status card). */
export function subscribeClaimUpdates(
  client: SupabaseClient,
  claimId: string,
  onUpdate: (row: ClaimRow) => void,
): RealtimeChannel {
  return client
    .channel(`claim-${claimId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'claims', filter: `id=eq.${claimId}` },
      (payload) => onUpdate(payload.new as ClaimRow),
    )
    .subscribe();
}

/** Detach an array of channels safely. Use in a cleanup callback. */
export async function unsubscribeAll(
  client: SupabaseClient,
  channels: RealtimeChannel[],
): Promise<void> {
  await Promise.all(channels.map((ch) => client.removeChannel(ch).catch(() => undefined)));
}
