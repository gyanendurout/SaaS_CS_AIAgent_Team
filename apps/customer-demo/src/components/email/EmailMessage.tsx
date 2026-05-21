'use client';

import { clock, cx, timeAgo } from '@/lib/format';
import type { EmailRow } from '@/lib/supabase/realtime';

export function EmailMessage({ email }: { email: EmailRow }) {
  const isInbound = email.direction === 'inbound'; // inbound = customer -> JOOLA
  const isFromJoola = email.direction === 'outbound'; // outbound from system = TO customer

  return (
    <article
      className={cx(
        'rounded-sm border bg-white p-4 shadow-sm',
        isFromJoola ? 'border-joola-yellow/60 border-l-4 border-l-joola-yellow' : 'border-joola-fog',
      )}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cx(
              'rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-mega',
              isInbound
                ? 'bg-joola-fog text-joola-graphite'
                : 'bg-joola-yellow text-joola-black',
            )}
          >
            {isInbound ? 'Sent' : 'From JOOLA'}
          </span>
          <span className="truncate font-sans text-xs text-joola-graphite">
            <span className="text-joola-stone">From</span>{' '}
            <span className="font-mono text-joola-ink">{email.from_addr}</span>{' '}
            <span className="text-joola-stone">→</span>{' '}
            <span className="font-mono text-joola-ink">{email.to_addr}</span>
          </span>
        </div>
        <time
          title={new Date(email.created_at).toLocaleString()}
          className="font-mono text-[11px] text-joola-stone"
        >
          {timeAgo(email.created_at)} · {clock(email.created_at)}
        </time>
      </header>
      <h4 className="m-0 mb-2 font-sans text-md font-bold tracking-tight text-joola-black">
        {email.subject || '(no subject)'}
      </h4>
      <p className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-joola-ink">
        {email.body}
      </p>
    </article>
  );
}
