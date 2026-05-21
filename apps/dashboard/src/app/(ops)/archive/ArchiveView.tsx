'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArchiveKPIs } from '@/components/archive/ArchiveKPIs';
import { FilterBar } from '@/components/archive/FilterBar';
import { StatusChips } from '@/components/archive/StatusChips';
import { ArchiveTable } from '@/components/archive/ArchiveTable';
import { ArchiveSide } from '@/components/archive/ArchiveSide';
import { PAGE_SIZE } from '@/lib/api/archive';
import { parseArchiveFilters, serializeArchiveFilters } from '@/lib/url-state';
import type { ArchiveFilters } from '@/lib/url-state';
import type { Agent, ArchiveRow } from '@/lib/supabase/types';

interface ArchiveViewProps {
  agents: Agent[];
}

/**
 * Client orchestrator for the /archive route. Owns:
 *   - URL <-> filter object sync (FilterBar, StatusChips, Pagination all
 *     dispatch patches through `applyPatch`)
 *   - the per-page rows snapshot used to compute the chip counts + KPIs
 */
export function ArchiveView({ agents }: ArchiveViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters: ArchiveFilters = useMemo(
    () => parseArchiveFilters(searchParams),
    [searchParams],
  );

  const [pageRows, setPageRows] = useState<ArchiveRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const handleRowsLoaded = useCallback((rows: ArchiveRow[], total: number) => {
    setPageRows(rows);
    setTotalCount(total);
  }, []);

  const applyPatch = useCallback(
    (patch: Partial<ArchiveFilters>) => {
      const next = { ...filters, ...patch };
      const sp = serializeArchiveFilters(next);
      const qs = sp.toString();
      // Preserve ?case=… if present so the drawer stays open through filter changes.
      const caseParam = searchParams?.get('case');
      const merged = new URLSearchParams(qs);
      if (caseParam) merged.set('case', caseParam);
      const final = merged.toString();
      router.replace(final ? `/archive?${final}` : '/archive');
    },
    [filters, router, searchParams],
  );

  // Status chip counts (status-agnostic baseline of current filters).
  const chipCounts = useMemo(() => {
    const open = pageRows.filter((r) => r.status === 'OPEN').length;
    const closed = pageRows.filter((r) => r.status === 'CLOSED').length;
    const reopened = pageRows.filter((r) => r.status === 'REOPENED').length;
    return { all: totalCount, open, closed, reopened };
  }, [pageRows, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="view-archive">
      <ArchiveKPIs rows={pageRows} totalCount={totalCount} />
      <FilterBar filters={filters} onChange={applyPatch} agents={agents} />
      <div className="archive">
        <div className="ar-main">
          <StatusChips filters={filters} onChange={applyPatch} counts={chipCounts} />
          <div className="results-meta">
            <span>
              <b>{totalCount}</b> tickets · sorted by newest
            </span>
            <span>
              Range · last {filters.range === 'all' ? '∞' : filters.range + 'd'} · Page{' '}
              <b>{filters.page + 1}</b> / {totalPages}
            </span>
          </div>
          <ArchiveTable filters={filters} onRowsLoaded={handleRowsLoaded} />
        </div>
        <ArchiveSide filters={filters} />
      </div>
    </div>
  );
}
