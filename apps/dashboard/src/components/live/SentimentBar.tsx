'use client';

interface SentimentBarProps {
  /** 0..1 — DB stores as numeric(3,2). Treats null as neutral 0.5. */
  value: number | null | undefined;
}

/**
 * Compact sentiment chip + bar shown in the call card footer. Bands:
 *   > 0.6 → green / "Positive"
 *   > 0.4 → yellow / "Neutral"
 *   else → red / "Frustrated"
 */
export function SentimentBar({ value }: SentimentBarProps) {
  const v = value ?? 0.5;
  const tone = v > 0.6 ? '' : v > 0.4 ? 'sentiment--neutral' : 'sentiment--negative';
  const label = v > 0.6 ? 'Positive' : v > 0.4 ? 'Neutral' : 'Frustrated';
  return (
    <div className={`sentiment ${tone}`}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ops-fg-3)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {label}
      </span>
      <div className="sentiment__bar">
        <i style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}
