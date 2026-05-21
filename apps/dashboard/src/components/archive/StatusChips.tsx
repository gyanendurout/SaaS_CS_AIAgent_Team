'use client';

import type { ArchiveFilters } from '@/lib/url-state';

interface StatusChipsProps {
  filters: ArchiveFilters;
  onChange: (patch: Partial<ArchiveFilters>) => void;
  counts: { all: number; open: number; closed: number; reopened: number };
}

/**
 * Status quick-pick chips: ALL / OPEN / CLOSED / REOPENED + flag toggles
 * (SLA / Escalated / Unauthorized seller). Mutually exclusive within the
 * status group, additive on the right-side flag group.
 */
export function StatusChips({ filters, onChange, counts }: StatusChipsProps) {
  return (
    <div className="chips">
      <div className="chips__group">
        <button
          className={`chipbtn ${filters.status === '' ? 'is-on' : ''}`}
          onClick={() => onChange({ status: '', page: 0 })}
        >
          ALL · {counts.all}
        </button>
        <button
          className={`chipbtn ${filters.status === 'OPEN' ? 'is-on' : ''}`}
          onClick={() => onChange({ status: 'OPEN', page: 0 })}
        >
          OPEN · {counts.open}
        </button>
        <button
          className={`chipbtn ${filters.status === 'CLOSED' ? 'is-on' : ''}`}
          onClick={() => onChange({ status: 'CLOSED', page: 0 })}
        >
          CLOSED · {counts.closed}
        </button>
        <button
          className={`chipbtn ${filters.status === 'REOPENED' ? 'is-on' : ''}`}
          onClick={() => onChange({ status: 'REOPENED', page: 0 })}
        >
          REOPENED · {counts.reopened}
        </button>
      </div>
      <div className="chips__group">
        <button
          className={`chipbtn ${filters.flagSLA ? 'is-on' : ''}`}
          onClick={() => onChange({ flagSLA: !filters.flagSLA, page: 0 })}
        >
          SLA BREACH
        </button>
        <button
          className={`chipbtn ${filters.flagEsc ? 'is-on' : ''}`}
          onClick={() => onChange({ flagEsc: !filters.flagEsc, page: 0 })}
        >
          ESCALATED
        </button>
        <button
          className={`chipbtn ${filters.flagUnauth ? 'is-on' : ''}`}
          onClick={() => onChange({ flagUnauth: !filters.flagUnauth, page: 0 })}
        >
          UNAUTHORIZED SELLER
        </button>
      </div>
    </div>
  );
}
