'use client';

import { getBrowserSupabase } from '@/lib/supabase/client';
import type {
  CaseEvent,
  Claim,
  Customer,
  Draft,
  Order,
  Registration,
  ReopenCategory,
  Transcript,
} from '@/lib/supabase/types';

export interface CaseEmail {
  id: string;
  claim_id: string;
  direction: 'inbound' | 'outbound';
  from_addr: string;
  to_addr: string;
  subject: string;
  body: string;
  sent_at: string;
  created_at: string;
}

/** Joined claim view used by CaseDrawer. Mirrors the design's flat shape. */
export interface CaseDetail {
  claim: Claim;
  customer: Customer;
  order: Order | null;
  registration: Registration | null;
  drafts: Draft | null;
  transcripts: Transcript[];
  emails: CaseEmail[];
}

/** Loads everything CaseDrawer needs in one round-trip per join. */
export async function fetchCase(claimId: string): Promise<CaseDetail | null> {
  const supabase = getBrowserSupabase();

  const { data: claimRaw, error: claimErr } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .maybeSingle();
  if (claimErr) throw new Error(`claims.fetch failed: ${claimErr.message}`);
  if (!claimRaw) return null;  const claim = claimRaw as Claim;

  const [{ data: customer }, ordRes, draftRes, transRes, emailsRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', claim.customer_id).maybeSingle(),
    claim.order_id
      ? supabase.from('orders').select('*').eq('id', claim.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('drafts')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transcripts')
      .select('*')
      .eq('claim_id', claimId)
      .order('line_index', { ascending: true }),
    supabase
      .from('emails')
      .select('*')
      .eq('claim_id', claimId)
      .order('sent_at', { ascending: true }),
  ]);

  if (!customer) return null;

  let registration: Registration | null = null;
  if (ordRes.data) {
    const { data: reg } = await supabase
      .from('registrations')
      .select('*')
      .eq('order_id', ordRes.data.id)
      .maybeSingle();
    registration = reg ?? null;
  }

  return {
    claim,
    customer,
    order: ordRes.data ?? null,
    registration,
    drafts: draftRes.data ?? null,
    transcripts: (transRes.data ?? []) as Transcript[],
    emails: (emailsRes.data ?? []) as CaseEmail[],
  };
}

export interface ApproveDraftPayload {
  edited_email_subject?: string;
  edited_email_body?: string;
  edited_voice?: string;
}

/** Approve (and optionally edit) an AI draft and send the outbound email. */
export async function approveCaseDraft(
  claimId: string,
  payload: ApproveDraftPayload = {},
): Promise<{ ok: true; draft_id: string }> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${base}/api/cases/${encodeURIComponent(claimId)}/approve-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`approve failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Send a "we need more info" reply and keep the claim open in
 * AWAITING_CUSTOMER_REPLY state. When the customer replies, the pipeline
 * re-runs automatically with the new information.
 */
export async function sendAndAwaitReply(
  claimId: string,
  payload: ApproveDraftPayload = {},
): Promise<{ ok: true; draft_id: string }> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${base}/api/cases/${encodeURIComponent(claimId)}/send-await-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`send-await-reply failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

/** Save in-progress edits to the draft without approving. */
export async function editCaseDraft(
  claimId: string,
  payload: ApproveDraftPayload,
): Promise<{ ok: true; draft_id: string }> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${base}/api/cases/${encodeURIComponent(claimId)}/edit-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`edit failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

/** Reads the 7-step agent timeline for a claim (drives the drawer's Timeline). */
export async function fetchCaseTimeline(claimId: string): Promise<CaseEvent[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from('case_events')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`case_events.fetch failed: ${error.message}`);
  return (data ?? []) as CaseEvent[];
}

export interface ReopenPayload {
  category: ReopenCategory;
  note: string;
}

/**
 * Fires the reopen mutation against apps/api. The dashboard never writes
 * directly to Postgres — all side-effecting work goes through the API so
 * `case_events` audit rows can be written in a single transaction.
 */
export async function reopenCase(claimId: string, payload: ReopenPayload): Promise<{ ok: true }> {
  if (!payload.note || payload.note.length < 5) {
    throw new Error('Reopen note must be at least 5 characters.');
  }
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${base}/api/cases/${encodeURIComponent(claimId)}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`reopen failed (${res.status}): ${text || res.statusText}`);
  }
  return { ok: true };
}
