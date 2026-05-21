'use client';

import { useEffect, useMemo, useState } from 'react';
import { StageRow } from './StageRow';
import { fetchPipelineSummary } from '@/lib/api/pipeline';
import { fetchDecisionMixToday } from '@/lib/api/kpi';
import { subscribeToTable } from '@/lib/supabase/realtime';
import type { DecisionMixRow, PipelineStageRow } from '@/lib/supabase/types';

interface PipelineProps {
  initialStages?: PipelineStageRow[];
  initialMix?: DecisionMixRow[];
}

const DEC_META: Record<
  string,
  { id: string; label: string }
> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: { id: 'eligible', label: 'Eligible · damage review' },
  HUMAN_REVIEW_REQUIRED:      { id: 'review',   label: 'Human review required' },
  NOT_ELIGIBLE:               { id: 'notelig',  label: 'Not eligible' },
  WARRANTY_EXPIRED:           { id: 'expired',  label: 'Warranty expired' },
  PROCESSING:                 { id: 'processing', label: 'Processing' },
};

const DEC_ORDER = [
  'ELIGIBLE_FOR_DAMAGE_REVIEW',
  'HUMAN_REVIEW_REQUIRED',
  'NOT_ELIGIBLE',
  'WARRANTY_EXPIRED',
  'PROCESSING',
] as const;

/**
 * Right-column top half — funnel + decision mix today. Reads from the two
 * views defined in 0003 (claim_pipeline_summary, decision_mix_today). Both
 * refresh on any claim INSERT/UPDATE.
 */
export function Pipeline({ initialStages = [], initialMix = [] }: PipelineProps) {
  const [stages, setStages] = useState<PipelineStageRow[]>(initialStages);
  const [mix, setMix] = useState<DecisionMixRow[]>(initialMix);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [s, m] = await Promise.all([fetchPipelineSummary(), fetchDecisionMixToday()]);
        if (!cancelled) {
          setStages(s);
          setMix(m);
        }
      } catch {
        /* swallow */
      }
    };
    if (initialStages.length === 0 || initialMix.length === 0) void refresh();
    const off = subscribeToTable('claims', () => void refresh());
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => stages.reduce((sum, s) => sum + (s.stage === 'closed' ? 0 : s.count), 0),
    [stages],
  );
  const grandTotal = useMemo(
    () => stages.reduce((sum, s) => sum + s.count, 0),
    [stages],
  );

  const mixMap = useMemo(() => {
    const m = new Map<string, number>();
    let sum = 0;
    for (const r of mix) {
      m.set(r.decision, r.count);
      sum += r.count;
    }
    return { byDecision: m, total: sum };
  }, [mix]);

  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Claim pipeline
          <span className="count mono">{total} ACTIVE</span>
        </div>
        <div className="panel__hdr-actions">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ops-fg-3)',
              letterSpacing: '.1em',
            }}
          >
            TODAY
          </span>
        </div>
      </div>
      <div className="panel__body">
        <div className="pipeline">
          {stages.map((s) => (
            <StageRow key={s.stage} row={s} />
          ))}
        </div>

        <div className="deccol" style={{ borderTop: '1px solid var(--ops-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="eyebrow">Decision mix · today</span>
            <span
              className="mono"
              style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
            >
              {grandTotal} TOTAL
            </span>
          </div>
          <div className="bars">
            {DEC_ORDER.map((dec) => {
              const meta = DEC_META[dec];
              if (!meta) return null;
              const count = mixMap.byDecision.get(dec) ?? 0;
              const pct = mixMap.total ? Math.round((count / mixMap.total) * 100) : 0;
              return (
                <div key={dec} className={`decbar ${meta.id}`}>
                  <span className="lbl">{meta.label}</span>
                  <span className="val">{count}</span>
                  <div className="track">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
