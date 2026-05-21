'use client';

import type { ArchiveRow } from '@/lib/supabase/types';
import { fmtDuration } from '@/lib/format';

interface ArchiveKPIsProps {
  rows: ArchiveRow[];
  totalCount: number;
}

/**
 * 7 mini-KPIs computed from the currently visible page of rows. The
 * `total` figure is the unpaged filter total returned by archive_query;
 * percentages are over the visible page (the same approach the design
 * takes) so the numbers feel responsive to filter changes.
 */
export function ArchiveKPIs({ rows, totalCount }: ArchiveKPIsProps) {
  const pageCount = rows.length || 1;
  const closed = rows.filter((t) => t.status === 'CLOSED').length;
  const open = rows.filter((t) => t.status === 'OPEN').length;
  const reopened = rows.filter((t) => t.status === 'REOPENED').length;
  const eligible = rows.filter((t) => t.decision === 'ELIGIBLE_FOR_DAMAGE_REVIEW').length;
  const auto = rows.filter((t) => t.primary_agent_id && t.primary_agent_id !== 'esc').length;

  const closedHandles = rows.filter((t) => t.status === 'CLOSED' && t.handle_seconds);
  const avgHandle = closedHandles.length
    ? Math.round(
        closedHandles.reduce((acc, r) => acc + (r.handle_seconds ?? 0), 0) /
          closedHandles.length,
      )
    : 0;

  const resPct = Math.round((closed / pageCount) * 100);
  const eligPct = Math.round((eligible / pageCount) * 100);
  const autoPct = Math.round((auto / pageCount) * 100);

  return (
    <div className="kpis kpis--archive">
      <div className="kpi">
        <div className="kpi__label">Tickets in range</div>
        <div className="kpi__value">
          <span className="num">{totalCount.toLocaleString()}</span>
        </div>
        <div className="kpi__delta flat">total matching filter</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Closed</div>
        <div className="kpi__value">
          <span className="num">{closed.toLocaleString()}</span>
          <span className="unit">{resPct}%</span>
        </div>
        <div className="kpi__delta up">▲ resolution rate</div>
      </div>
      <div className="kpi kpi--accent">
        <div className="kpi__label">Open</div>
        <div className="kpi__value">
          <span className="num">{open}</span>
        </div>
        <div className="kpi__delta flat">in progress</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Reopened</div>
        <div className="kpi__value">
          <span className="num">{reopened}</span>
        </div>
        <div className="kpi__delta flat">customer follow-ups</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Eligible</div>
        <div className="kpi__value">
          <span className="num">{eligPct}</span>
          <span className="unit">%</span>
        </div>
        <div className="kpi__delta up">damage review · {eligible}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Auto-resolved</div>
        <div className="kpi__value">
          <span className="num">{autoPct}</span>
          <span className="unit">%</span>
        </div>
        <div className="kpi__delta up">no human touch</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Avg handle</div>
        <div className="kpi__value">
          <span className="num">{fmtDuration(avgHandle)}</span>
        </div>
        <div className="kpi__delta up">closed tickets</div>
      </div>
    </div>
  );
}
