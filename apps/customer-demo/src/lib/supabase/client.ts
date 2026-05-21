/**
 * Browser-side Supabase client.
 *
 * One client per browser tab. Realtime subscriptions for the email inbox
 * + claim status card are scoped per-component via `client.channel(...)`.
 *
 * Uses the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) — never the
 * secret service-role key.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // Throwing here gives a clearer dev error than letting createClient fail
    // somewhere deep with a less-descriptive message.
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.',
    );
  }

  cached = createClient(url, key, {
    auth: {
      // No auth in the demo — the anon key has RLS access via demo_anon_all policies.
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });

  return cached;
}
