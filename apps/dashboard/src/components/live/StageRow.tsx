'use client';

import type { PipelineStageRow } from '@/lib/supabase/types';

const STAGE_META: Record<
  PipelineStageRow['stage'],
  { name: string; sub: string; active: boolean }
> = {
  intake: { name: 'Intake',           sub: 'Receive + classify',         active: true  },
  verify: { name: 'Verifying',        sub: 'Shopify + Warranty DB',      active: true  },
  rules:  { name: 'Policy applied',   sub: 'Rule engine decision',       active: true  },
  draft:  { name: 'Response drafted', sub: 'Email + voice draft',        active: true  },
  closed: { name: 'Resolved / closed', sub: 'Awaiting customer / sent',  active: false },
};

/**
 * One row inside the Pipeline. Stuck count appears in red if > 0 (replaces
 * the avg duration), which matches the design's behavior.
 */
export function StageRow({ row }: { row: PipelineStageRow }) {
  const meta = STAGE_META[row.stage];
  const isStuck = row.stuck_count > 0;
  const isActive = meta.active;
  return (
    <div className={`stage-row ${isActive ? 'is-active' : ''} ${isStuck ? 'is-stuck' : ''}`}>
      <div className="node" />
      <div className="name">
        {meta.name}
        <span>{meta.sub}</span>
      </div>
      <div className="meta">
        {row.count}
        <span>
          {isStuck ? (
            <span style={{ color: 'var(--ops-red)' }}>{row.stuck_count} stuck</span>
          ) : (
            'avg —'
          )}
        </span>
      </div>
    </div>
  );
}
