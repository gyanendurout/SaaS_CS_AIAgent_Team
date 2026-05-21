'use client';

interface SparkProps {
  data: number[];
  color?: string;
}

/**
 * Tiny inline SVG sparkline used inside KPI cards. Reads the parent box
 * via absolute positioning (see .spark in globals.css) — the viewBox
 * scales to the box without changing the line weight perceptibly.
 */
export function Spark({ data, color = 'var(--ops-yellow)' }: SparkProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 22;
  const step = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
