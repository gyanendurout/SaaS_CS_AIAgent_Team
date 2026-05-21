'use client';

import { useMemo } from 'react';
import type { ArchiveAggregates } from '@/lib/supabase/types';

interface DailyVolumeProps {
  agg: ArchiveAggregates;
  /** Range string from filters: '1' | '7' | '30' | '90' | 'all'. */
  range: string;
}

/** Per-day bar chart sourced from archive_aggregates.daily_volume. */
export function DailyVolume({ agg, range }: DailyVolumeProps) {
  const buckets = useMemo(() => {
    const n = range === 'all' ? 30 : Number(range) || 30;
    const arr = new Array<number>(n).fill(0);

    // archive_aggregates returns [{ date: 'YYYY-MM-DD', count }] sorted by date.
    // Map each to its (now - days-ago) bucket. Days outside range fall off.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const d of agg.daily_volume) {
      const date = new Date(d.date);
      date.setHours(0, 0, 0, 0);
      const offset = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
      if (offset >= 0 && offset < n) {
        arr[n - 1 - offset] = d.count;
      }
    }
    return arr;
  }, [agg.daily_volume, range]);

  const max = Math.max(...buckets, 1);
  const total = buckets.reduce((a, b) => a + b, 0);

  return (
    <div className="ar-block">
      <h4>
        Daily volume <span className="meta">{total} TIX</span>
      </h4>
      <div className="dailybars">
        {buckets.map((v, i) => (
          <i
            key={i}
            className={i === buckets.length - 1 ? 'peak' : ''}
            style={{ height: `${(v / max) * 100}%` }}
            title={`${v} tickets`}
          />
        ))}
      </div>
      <div className="dailybars-labels">
        <span>{buckets.length}d ago</span>
        <span>today</span>
      </div>
    </div>
  );
}
