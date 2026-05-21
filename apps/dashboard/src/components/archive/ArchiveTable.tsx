'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArchiveTableRow } from './ArchiveTableRow';
import { Pagination } from './Pagination';
import { archiveQuery } from '@/lib/api/archive';
import type { ArchiveFilters } from '@/lib/url-state';
import { serializeArchiveFilters } from '@/lib/url-state';

interface ArchiveTableProps {
  filters: ArchiveFilters;
  /** Returned to parent so it can compute KPIs from the page rows. */
  onRowsLoaded?: (rows: import('@/lib/supabase/types').ArchiveRow[], total: number) => void;
}

/**
 * Paginated 18-row archive table. React Query keyed on the entire filter
 * payload so any patch via FilterBar / StatusChips / Pagination triggers a
 * fresh `archive_query` call. 60s stale time matches the QueryClient
 * default — archive data is historical, not live.
 */
export function ArchiveTable({ filters, onRowsLoaded }: ArchiveTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['archive', filters],
    queryFn: () => archiveQuery(filters),
  });

  // Forward to parent for KPI computation, guarded by useEffect so we don't
  // call setState during render.
  useEffect(() => {
    if (data && onRowsLoaded) {
      onRowsLoaded(data.rows, data.totalCount);
    }
  }, [data, onRowsLoaded]);

  const setPage = (page: number) => {
    const sp = serializeArchiveFilters({ ...filters, page });
    const qs = sp.toString();
    router.replace(qs ? `/archive?${qs}` : '/archive');
  };

  const openCase = (id: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('case', id);
    router.replace(`/archive?${next.toString()}`);
  };

  const reopenCase = (id: string) => {
    // Open the drawer; the drawer renders a "Reopen → Live" button which
    // launches the ReopenModal. Keeps the table itself stateless.
    openCase(id);
  };

  return (
    <>
      <div className="tbl-wrap" style={{ position: 'relative' }}>
        {isLoading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 2, background: 'var(--ops-yellow)',
            animation: 'progress-bar 1.2s ease-in-out infinite',
            zIndex: 10,
          }} />
        )}
        {error ? (
          <div className="empty">
            <div className="big">Failed to load</div>
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : isLoading && !data ? (
          <div className="empty">
            <div className="big">Loading…</div>
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="empty">
            <div className="big">No tickets match</div>
            Try widening the date range or clearing filters.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 110 }}>OPENED</th>
                <th style={{ width: 84 }}>CHANNEL</th>
                <th style={{ width: 92 }}>ID</th>
                <th>CUSTOMER · PRODUCT</th>
                <th style={{ width: 140 }}>ISSUE</th>
                <th style={{ width: 120 }}>DECISION</th>
                <th style={{ width: 90 }}>STATUS</th>
                <th style={{ width: 110 }}>RESOLVED</th>
                <th style={{ width: 90 }}>HANDLE</th>
                <th style={{ width: 130 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <ArchiveTableRow
                  key={row.id}
                  row={row}
                  onOpen={openCase}
                  onReopen={reopenCase}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination
        page={filters.page}
        totalRows={data?.totalCount ?? 0}
        onChange={setPage}
      />
    </>
  );
}
