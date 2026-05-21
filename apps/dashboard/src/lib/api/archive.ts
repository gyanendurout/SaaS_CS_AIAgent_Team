'use client';

import { getBrowserSupabase } from '@/lib/supabase/client';
import type {
  ArchiveAggregates,
  ArchiveRow,
} from '@/lib/supabase/types';
import type { ArchiveFilters } from '@/lib/url-state';
import { filtersToRpcJson } from '@/lib/url-state';

const PAGE_SIZE = 18;

export interface ArchiveQueryResult {
  rows: ArchiveRow[];
  totalCount: number;
}

/**
 * Calls the `archive_query` RPC defined in migrations/0003_rpc_functions.sql.
 * Returns the paginated rows plus the unpaged total (the RPC returns
 * total_count as a window aggregate on every row).
 */
export async function archiveQuery(filters: ArchiveFilters): Promise<ArchiveQueryResult> {
  const supabase = getBrowserSupabase();

  const args = {
    p_q:           filters.q || null,
    p_range_days:  filters.range === 'all' ? null : Number(filters.range),
    p_channel:     filters.channel || null,
    p_decision:    filters.decision || null,
    p_agent:       filters.agent || null,
    p_status:      filters.status || null,
    p_flag_sla:    filters.flagSLA,
    p_flag_esc:    filters.flagEsc,
    p_flag_unauth: filters.flagUnauth,
    p_page:        filters.page,
    p_page_size:   PAGE_SIZE,
  };

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .rpc('archive_query' as any, args as any);

  if (error) throw new Error(`archive_query failed: ${error.message}`);

  const rows = (data ?? []) as ArchiveRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  return { rows, totalCount: Number(totalCount) };
}

/** Side-panel aggregates: daily volume, decision donut, leaderboards, etc. */
export async function archiveAggregates(filters: ArchiveFilters): Promise<ArchiveAggregates> {
  const supabase = getBrowserSupabase();

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .rpc('archive_aggregates' as any, { p_filters: filtersToRpcJson(filters) } as any);

  if (error) throw new Error(`archive_aggregates failed: ${error.message}`);

  // Defensive defaults if the RPC returns an empty object on a no-match set.
  const j = (data ?? {}) as Partial<ArchiveAggregates>;
  return {
    daily_volume:      j.daily_volume      ?? [],
    decision_mix:      j.decision_mix      ?? {},
    agent_leaderboard: j.agent_leaderboard ?? [],
    channel_mix:       j.channel_mix       ?? {},
    top_issues:        j.top_issues        ?? [],
  };
}

/** Build the CSV-export download URL the FilterBar opens in a new tab. */
export function buildExportUrl(filters: ArchiveFilters): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const sp = new URLSearchParams();
  if (filters.q)        sp.set('q', filters.q);
  if (filters.range)    sp.set('range', filters.range);
  if (filters.channel)  sp.set('channel', filters.channel);
  if (filters.decision) sp.set('decision', filters.decision);
  if (filters.agent)    sp.set('agent', filters.agent);
  if (filters.status)   sp.set('status', filters.status);
  if (filters.flagSLA)  sp.set('flag_sla', '1');
  if (filters.flagEsc)  sp.set('flag_esc', '1');
  if (filters.flagUnauth) sp.set('flag_unauth', '1');
  return `${base}/api/archive/export.csv?${sp.toString()}`;
}

export { PAGE_SIZE };
