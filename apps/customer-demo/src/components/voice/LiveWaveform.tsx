'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceStatus } from '@/lib/vapi/types';
import { cx } from '@/lib/format';

const BAR_COUNT = 28;

/**
 * Pure-CSS animated waveform. We don't tap the live Vapi audio stream — the
 * animation is purely visual feedback that *something* is happening. Bars
 * pulse during listening/speaking/processing and flatline at idle.
 */
export function LiveWaveform({ status }: { status: VoiceStatus }) {
  const seeds = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => ({
      delay: (i * 47) % 380,
      duration: 600 + ((i * 73) % 400),
      base: 18 + ((i * 31) % 36),
    }));
  }, []);

  // We toggle a tick to retrigger animations each second of active speech,
  // so bars don't look "frozen" if the user pauses and resumes mid-call.
  const [, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'listening' && status !== 'speaking') return;
    let last = performance.now();
    const loop = (now: number) => {
      if (now - last > 1000) {
        setTick((n) => n + 1);
        last = now;
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  const active = status === 'listening' || status === 'speaking' || status === 'processing';
  const color =
    status === 'speaking'
      ? 'bg-joola-court-blue'
      : status === 'processing'
        ? 'bg-joola-stone'
        : 'bg-joola-black';

  return (
    <div className="flex h-24 items-center justify-center gap-[3px]" aria-hidden>
      {seeds.map((s, i) => (
        <span
          key={i}
          className={cx(
            'inline-block w-[3px] rounded-pill',
            color,
            active ? 'animate-[wave_var(--dur)_ease-in-out_infinite_alternate]' : '',
          )}
          style={
            active
              ? ({
                  '--dur': `${s.duration}ms`,
                  animationDelay: `${s.delay}ms`,
                  height: `${s.base}%`,
                } as React.CSSProperties)
              : { height: '14%' }
          }
        />
      ))}
    </div>
  );
}
