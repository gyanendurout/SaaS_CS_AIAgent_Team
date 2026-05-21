'use client';

import type { ArchiveAggregates, DecisionType } from '@/lib/supabase/types';
import { DECISION_COLOR, DECISION_LABEL } from '@/lib/design-tokens';

const ORDER: DecisionType[] = [
  'ELIGIBLE_FOR_DAMAGE_REVIEW',
  'HUMAN_REVIEW_REQUIRED',
  'NOT_ELIGIBLE',
  'WARRANTY_EXPIRED',
  'PROCESSING',
];

interface DecisionDonutProps {
  agg: ArchiveAggregates;
}

/**
 * SVG donut for decision mix. Each arc is one stroke-dasharray segment on
 * a single circle; we rotate -90deg in CSS so arcs start at 12 o'clock.
 */
export function DecisionDonut({ agg }: DecisionDonutProps) {
  const data = agg.decision_mix;
  const total = Object.values(data).reduce<number>((a, v) => a + (v ?? 0), 0) || 1;
  const r = 36;
  const c = 50;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="ar-block">
      <h4>
        Decision mix <span className="meta">RULE ENGINE</span>
      </h4>
      <div className="donut-wrap">
        <svg viewBox="0 0 100 100" aria-label="Decision mix donut chart">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ops-panel-3)" strokeWidth={14} />
          {ORDER.map((k) => {
            const v = data[k] ?? 0;
            if (v === 0) return null;
            const portion = v / total;
            const len = portion * circ;
            const dash = `${len} ${circ - len}`;
            const arc = (
              <circle
                key={k}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={DECISION_COLOR[k]}
                strokeWidth={14}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return arc;
          })}
        </svg>
        <div className="donut-legend">
          {ORDER.map((k) => (
            <div key={k} className="row">
              <span className="sw" style={{ background: DECISION_COLOR[k] }} />
              <span className="lbl">{DECISION_LABEL[k]}</span>
              <span className="val">{data[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
