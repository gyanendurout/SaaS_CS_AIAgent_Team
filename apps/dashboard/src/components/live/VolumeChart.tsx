'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';

/**
 * 24-hourly volume chart synthesized client-side by bucketing claim
 * created_at timestamps. We pull the last 24h of claims (id + created_at
 * only — cheap) and bucket them into the 24 hourly slots ending at NOW.
 */
export function VolumeChart() {
  const supabase = useSupabase();
  const [samples, setSamples] = useState<number[]>(() => Array(24).fill(0));

  const load = async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('claims')
      .select('created_at')
      .gte('created_at', cutoff);

    const buckets = new Array<number>(24).fill(0);
    const now = Date.now();
    for (const row of (data ?? []) as { created_at: string }[]) {
      const ms = new Date(row.created_at).getTime();
      const hoursAgo = Math.floor((now - ms) / 3_600_000);
      const idx = 23 - hoursAgo;
      if (idx >= 0 && idx < 24) buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    setSamples(buckets);
  };

  useEffect(() => {
    void load();
    const off = subscribeToTable('claims', () => void load(), 'INSERT');
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const max = useMemo(() => Math.max(...samples, 1), [samples]);
  const total = useMemo(() => samples.reduce((a, b) => a + b, 0), [samples]);

  return (
    <div className="mc">
      <div className="mc__h">
        <span className="eyebrow">Volume · last 24h</span>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
        >
          {total} INQUIRIES
        </span>
      </div>
      <div className="spark-tall">
        {samples.map((v, i) => (
          <i
            key={i}
            className={i === samples.length - 1 ? 'now' : ''}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--ops-fg-4)',
          marginTop: 4,
          letterSpacing: '.08em',
        }}
      >
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
