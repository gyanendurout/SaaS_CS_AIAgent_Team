'use client';

import { cx } from '@/lib/format';
import type { VoiceStatus } from '@/lib/vapi/types';

type Props = {
  status: VoiceStatus;
  onStart: () => void;
  onEnd: () => void;
  disabled?: boolean;
};

/**
 * The single big call-control button. Morphs between "Start call" (idle/ended/error)
 * and "End call" (everything else). Always large and central so the CEO can see
 * it from the back of the room during the demo.
 */
export function VoiceCallButton({ status, onStart, onEnd, disabled }: Props) {
  const isActive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'processing';

  const label = isActive
    ? status === 'connecting' ? 'Connecting…' : 'End call'
    : 'Start call';

  return (
    <button
      type="button"
      onClick={isActive ? onEnd : onStart}
      disabled={disabled}
      className={cx(
        'group relative grid h-32 w-32 place-items-center rounded-pill font-sans text-sm font-bold uppercase tracking-tight transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-joola-yellow',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isActive
          ? 'bg-joola-red text-white hover:bg-joola-red-deep'
          : 'bg-joola-yellow text-joola-black hover:bg-joola-yellow-deep',
        (status === 'listening' || status === 'speaking') &&
          'shadow-[0_0_0_10px_rgba(245,230,37,.18),0_0_0_22px_rgba(245,230,37,.08)]',
      )}
      aria-label={label}
    >
      <span className="flex flex-col items-center gap-1">
        <span aria-hidden className="text-2xl">
          {isActive ? '■' : '☎'}
        </span>
        <span>{label}</span>
      </span>
    </button>
  );
}
