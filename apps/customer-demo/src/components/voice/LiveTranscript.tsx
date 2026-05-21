'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptLine } from '@/lib/vapi/types';
import { cx } from '@/lib/format';

/**
 * Scrolling transcript pane. New lines auto-scroll into view. Partial lines
 * (mid-utterance) are dimmed; final lines are full-weight.
 */
export function LiveTranscript({ lines }: { lines: TranscriptLine[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length, lines[lines.length - 1]?.text]);

  if (lines.length === 0) {
    return (
      <div className="grid h-48 place-items-center rounded-sm border border-dashed border-joola-fog bg-joola-paper">
        <p className="m-0 text-sm text-joola-stone">Transcript will appear here once the call starts.</p>
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-sm border border-joola-fog bg-white p-4">
      <ul className="m-0 flex flex-col gap-3 p-0">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3">
            <span
              className={cx(
                'mt-0.5 inline-block min-w-[68px] rounded-pill px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-mega',
                line.role === 'user'
                  ? 'bg-joola-yellow text-joola-black'
                  : 'bg-joola-court-blue text-white',
              )}
            >
              {line.role === 'user' ? 'Customer' : 'JOOLA AI'}
            </span>
            <p
              className={cx(
                'm-0 flex-1 font-sans text-sm leading-relaxed',
                line.final ? 'text-joola-ink' : 'italic text-joola-stone',
              )}
            >
              {line.text}
              {!line.final && <span className="ml-1 animate-pulse">▍</span>}
            </p>
          </li>
        ))}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
