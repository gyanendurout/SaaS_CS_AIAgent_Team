'use client';

import type { ArchiveAggregates } from '@/lib/supabase/types';

const GLYPH: Record<string, string> = {
  intake: '01',
  shopify: '02',
  warrreg: '03',
  rules: '04',
  summary: '05',
  response: '06',
  esc: '07',
};

interface AgentLeaderboardProps {
  agg: ArchiveAggregates;
}

/** "By primary agent" bar list, sorted desc by ticket count. */
export function AgentLeaderboard({ agg }: AgentLeaderboardProps) {
  const data = agg.agent_leaderboard;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="ar-block">
      <h4>
        By primary agent <span className="meta">FINALIZED</span>
      </h4>
      <div>
        {data.map((d, i) => (
          <div key={d.agent_id} className="leader">
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="name">
              <span className="glyph">{GLYPH[d.agent_id] ?? '—'}</span>
              {d.name}
            </span>
            <span className="num">{d.count}</span>
            <div className="bar">
              <i style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
