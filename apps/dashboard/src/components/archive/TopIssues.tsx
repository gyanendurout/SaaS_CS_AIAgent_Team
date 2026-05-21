'use client';

import type { ArchiveAggregates } from '@/lib/supabase/types';

interface TopIssuesProps {
  agg: ArchiveAggregates;
}

/** Top-6 reported issue strings, sourced from archive_aggregates.top_issues. */
export function TopIssues({ agg }: TopIssuesProps) {
  const data = agg.top_issues;
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="ar-block">
      <h4>
        Top issues <span className="meta">{total} TIX</span>
      </h4>
      <div className="toplist">
        {data.map((d) => (
          <div className="topitem" key={d.issue}>
            <span className="lbl" title={d.issue}>{d.issue}</span>
            <span className="val">{d.count}</span>
            <div className="bar">
              <i style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
