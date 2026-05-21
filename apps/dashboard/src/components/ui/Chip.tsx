'use client';

import type { ReactNode } from 'react';

type Tone = 'default' | 'yellow' | 'green' | 'red' | 'orange' | 'blue' | 'purple';

const TONE_CLASS: Record<Tone, string> = {
  default: 'bg-ops-panel-3 text-ops-fg-2',
  yellow:  'bg-ops-yellow text-joola-black',
  green:   'bg-ops-green/15 text-ops-green',
  red:     'bg-ops-red/15 text-ops-red',
  orange:  'bg-ops-orange/15 text-ops-orange',
  blue:    'bg-ops-blue/15 text-ops-blue',
  purple:  'bg-ops-purple/15 text-ops-purple',
};

interface ChipProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/** Pill used for status badges, decision tags, counts. Square-cornered to match ops styling. */
export function Chip({ tone = 'default', className = '', children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] font-bold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
