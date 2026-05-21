'use client';

import { PAGE_SIZE } from '@/lib/api/archive';

interface PaginationProps {
  page: number;          // zero-based
  totalRows: number;
  onChange: (page: number) => void;
}

/** Footer pagination — first / prev / numbered / next / last. */
export function Pagination({ page, totalRows, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const start = totalRows === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(totalRows, (page + 1) * PAGE_SIZE);

  const numericStart = Math.max(0, Math.min(page - 3, totalPages - 7));

  return (
    <div className="pagi">
      <div>
        SHOWING {start}–{end} OF{' '}
        <b style={{ color: 'var(--ops-fg)' }}>{totalRows}</b>
      </div>
      <div className="pagi__nav">
        <button disabled={page === 0} onClick={() => onChange(0)}>«</button>
        <button disabled={page === 0} onClick={() => onChange(page - 1)}>‹</button>
        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
          const n = numericStart + i;
          if (n >= totalPages) return null;
          return (
            <button
              key={n}
              className={n === page ? 'is-current' : ''}
              onClick={() => onChange(n)}
            >
              {n + 1}
            </button>
          );
        })}
        <button disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>›</button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onChange(totalPages - 1)}
        >
          »
        </button>
      </div>
    </div>
  );
}
