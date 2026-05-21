'use client';

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { getBrowserSupabase } from './client';

export type TableEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribe to Postgres change events on `table` and forward them to `callback`.
 * Returns a teardown function that must be called from a React useEffect cleanup
 * — leaving a channel open after the component unmounts leaks the WebSocket
 * subscription and stacks duplicate listeners on subsequent re-mounts.
 */
export function subscribeToTable<Row extends object = Record<string, unknown>>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<Row & Record<string, unknown>>) => void,
  event: TableEvent = '*',
  filter?: string,
): () => void {
  const supabase = getBrowserSupabase();
  const channelName = `dash:${table}:${event}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      // The supabase-js type definitions for `on('postgres_changes', ...)` are
      // overly strict at compile time; we widen them here to keep the helper
      // simple. Runtime behavior is unaffected.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event, schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload: RealtimePostgresChangesPayload<Row & Record<string, unknown>>) => callback(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
