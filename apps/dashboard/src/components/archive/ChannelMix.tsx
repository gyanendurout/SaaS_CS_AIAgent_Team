'use client';

import type { ArchiveAggregates, ChannelType } from '@/lib/supabase/types';

const CHANNEL_META: Array<{ id: ChannelType; label: string; color: string }> = [
  { id: 'voice', label: 'Voice',    color: 'var(--ops-yellow)' },
  { id: 'email', label: 'Email',    color: 'var(--ops-blue)' },
  { id: 'web',   label: 'Web form', color: 'var(--ops-purple)' },
];

interface ChannelMixProps {
  agg: ArchiveAggregates;
}

/** Channel split bars (voice / email / web). */
export function ChannelMix({ agg }: ChannelMixProps) {
  const data = agg.channel_mix;
  const total = Object.values(data).reduce<number>((a, v) => a + (v ?? 0), 0) || 1;

  return (
    <div className="ar-block">
      <h4>
        Channel mix <span className="meta">{total} TIX</span>
      </h4>
      {CHANNEL_META.map((c) => {
        const count = data[c.id] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div className="topitem" key={c.id}>
            <span className="lbl">{c.label}</span>
            <span className="val">
              {count} · {pct}%
            </span>
            <div className="bar">
              <i style={{ width: `${pct}%`, background: c.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
