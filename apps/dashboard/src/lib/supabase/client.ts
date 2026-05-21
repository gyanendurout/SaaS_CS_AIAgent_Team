'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Browser-side Supabase client. Uses the publishable (anon) key — the demo
 * RLS posture defined in migration 0001 grants anon full read access.
 *
 * One singleton is kept per browser tab so Realtime channels stick to the
 * same WebSocket connection across React re-mounts.
 */

let _client: SupabaseClient<Database> | null = null;

export function getBrowserSupabase(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for the dashboard.',
    );
  }

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  return _client;
}
