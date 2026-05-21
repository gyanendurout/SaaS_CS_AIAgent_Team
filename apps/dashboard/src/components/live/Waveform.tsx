'use client';

import { useMemo } from 'react';

interface WaveformProps {
  active: boolean;
}

/**
 * 22-bar pseudo-waveform used in active voice call cards. When `active` is
 * false the bars freeze at their seed heights — useful for finished calls
 * that we still want to render but shouldn't animate.
 */
export function Waveform({ active }: WaveformProps) {
  const bars = useMemo(() => Array.from({ length: 22 }, () => Math.random()), []);
  return (
    <div className="call__wave" aria-hidden="true">
      {bars.map((b, i) => (
        <i
          key={i}
          style={{
            animationDelay: `${i * 60}ms`,
            animationPlayState: active ? 'running' : 'paused',
            ...(active ? {} : { height: `${20 + b * 30}%` }),
          }}
        />
      ))}
    </div>
  );
}
