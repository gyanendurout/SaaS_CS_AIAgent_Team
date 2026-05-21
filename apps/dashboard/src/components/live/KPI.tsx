'use client';

import type { ReactNode } from 'react';
import { Spark } from './Spark';

interface KPIProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  sparkData?: number[];
  accent?: boolean;
  danger?: boolean;
}

/**
 * Single KPI tile in the header strip. The accent variant uses JOOLA yellow
 * for the number (used for "Open claims"); the danger variant uses red
 * (used for "Escalations"). The Spark is positioned absolutely against
 * the tile via the .spark CSS class.
 */
export function KPI({ label, value, unit, delta, deltaDir, sparkData, accent, danger }: KPIProps) {
  let cls = 'kpi';
  if (accent) cls += ' kpi--accent';
  if (danger) cls += ' kpi--danger';

  const sparkColor = danger ? 'var(--ops-red)' : accent ? 'var(--ops-yellow)' : 'var(--ops-fg-3)';

  return (
    <div className={cls}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta != null && (
        <div className={`kpi__delta ${deltaDir ?? 'flat'}`}>
          {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '◆'} {delta}
        </div>
      )}
      {sparkData && <Spark data={sparkData} color={sparkColor} />}
    </div>
  );
}
