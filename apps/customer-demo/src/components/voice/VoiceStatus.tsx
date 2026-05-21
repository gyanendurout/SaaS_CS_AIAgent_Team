'use client';

import { cx } from '@/lib/format';
import type { VoiceStatus as Status } from '@/lib/vapi/types';

const STATE_LABEL: Record<Status, string> = {
  idle: 'Ready',
  connecting: 'Connecting…',
  listening: 'Listening',
  speaking: 'JOOLA is speaking',
  processing: 'Thinking…',
  ended: 'Call ended',
  error: 'Error',
};

const STATE_TONE: Record<Status, string> = {
  idle: 'bg-joola-fog text-joola-graphite',
  connecting: 'bg-joola-yellow-soft text-joola-black',
  listening: 'bg-joola-yellow text-joola-black',
  speaking: 'bg-joola-court-blue text-white',
  processing: 'bg-joola-fog text-joola-black',
  ended: 'bg-joola-fog text-joola-graphite',
  error: 'bg-joola-red text-white',
};

export function VoiceStatus({ status, label }: { status: Status; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={cx(
          'h-2 w-2 rounded-pill',
          status === 'listening' && 'bg-joola-yellow animate-pulse',
          status === 'speaking' && 'bg-joola-court-blue animate-pulse',
          status === 'connecting' && 'bg-joola-stone animate-pulse',
          status === 'idle' && 'bg-joola-mist',
          status === 'ended' && 'bg-joola-mist',
          status === 'processing' && 'bg-joola-stone animate-pulse',
          status === 'error' && 'bg-joola-red',
        )}
      />
      <span
        className={cx(
          'rounded-pill px-3 py-0.5 font-mono text-[11px] uppercase tracking-wide',
          STATE_TONE[status],
        )}
      >
        {label ?? STATE_LABEL[status]}
      </span>
    </div>
  );
}
