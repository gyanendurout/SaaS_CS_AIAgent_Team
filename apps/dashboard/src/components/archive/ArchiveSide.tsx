'use client';

import { useQuery } from '@tanstack/react-query';
import { DailyVolume } from './DailyVolume';
import { DecisionDonut } from './DecisionDonut';
import { AgentLeaderboard } from './AgentLeaderboard';
import { ChannelMix } from './ChannelMix';
import { TopIssues } from './TopIssues';
import { archiveAggregates } from '@/lib/api/archive';
import type { ArchiveFilters } from '@/lib/url-state';

interface ArchiveSideProps {
  filters: ArchiveFilters;
}

/**
 * Right-side analytics rail. Fires a single archive_aggregates call —
 * cheaper than 5 separate queries — and distributes the result to each
 * panel. Keyed on filters, so changing any control invalidates atomically.
 */
export function ArchiveSide({ filters }: ArchiveSideProps) {
  // Strip page/pagination concerns from the cache key — aggregates don't paginate.
  const aggKey = { ...filters, page: 0 };

  const { data, isLoading, error } = useQuery({
    queryKey: ['archive-agg', aggKey],
    queryFn: () => archiveAggregates(filters),
  });

  if (error) {
    return (
      <aside className="ar-side">
        <div className="ar-block">
          <h4>Analytics failed</h4>
          <div style={{ fontSize: 11, color: 'var(--ops-fg-3)' }}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </aside>
    );
  }

  if (isLoading || !data) {
    return (
      <aside className="ar-side">
        <div className="ar-block">
          <h4>Loading analytics…</h4>
        </div>
      </aside>
    );
  }

  return (
    <aside className="ar-side">
      <DailyVolume agg={data} range={filters.range} />
      <DecisionDonut agg={data} />
      <AgentLeaderboard agg={data} />
      <ChannelMix agg={data} />
      <TopIssues agg={data} />
    </aside>
  );
}
