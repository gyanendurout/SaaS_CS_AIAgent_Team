'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSupabase } from '@/providers/SupabaseProvider';
import {
  subscribeCustomerEmails,
  unsubscribeAll,
  type EmailRow,
} from '@/lib/supabase/realtime';
import { EmailMessage } from './EmailMessage';
import { EmptyInbox } from './EmptyInbox';

/**
 * Inbox for the currently-selected customer.
 *
 * Loads the initial page from `emails` filtered on either `to_addr` or
 * `from_addr` equal to the customer email, then subscribes to INSERTs on
 * both filters to keep the list fresh.
 *
 * Emails are grouped by `claim_id` so multi-turn threads stay together;
 * within a thread, newest at the bottom (read top-down like a chat).
 */
export function EmailInbox() {
  const { client, current } = useSupabase();
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch — re-runs every time the active customer changes
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: err } = await client
        .from('emails')
        .select('*')
        .or(`to_addr.eq.${current.email},from_addr.eq.${current.email}`)
        .order('created_at', { ascending: true })
        .limit(200);

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setEmails([]);
      } else {
        setEmails((data ?? []) as EmailRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, current]);

  // Realtime subscription
  useEffect(() => {
    if (!current) return;
    const channels = subscribeCustomerEmails(client, current.email, (row) => {
      setEmails((cur) => (cur.some((e) => e.id === row.id) ? cur : [...cur, row]));
    });
    return () => {
      void unsubscribeAll(client, channels);
    };
  }, [client, current]);

  const threads = useMemo(() => {
    const map = new Map<string, EmailRow[]>();
    for (const e of emails) {
      const arr = map.get(e.claim_id) ?? [];
      arr.push(e);
      map.set(e.claim_id, arr);
    }
    // Sort threads by their most recent email (newest first)
    return [...map.entries()]
      .map(([claimId, msgs]) => ({
        claimId,
        msgs: [...msgs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      }))
      .sort((a, b) => {
        const aLast = a.msgs[a.msgs.length - 1]?.created_at ?? '';
        const bLast = b.msgs[b.msgs.length - 1]?.created_at ?? '';
        return new Date(bLast).getTime() - new Date(aLast).getTime();
      });
  }, [emails]);

  if (!current) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-sm border border-joola-fog bg-white">
        <span className="font-mono text-xs uppercase tracking-mega text-joola-stone">Loading inbox…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-joola-red bg-rose-50 p-3">
        <p className="m-0 text-sm text-joola-red">Could not load inbox: {error}</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return <EmptyInbox customerName={current.name} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {threads.map((t) => (
        <section key={t.claimId} className="flex flex-col gap-2">
          <header className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
              Thread
            </h3>
            <span className="font-mono text-[11px] text-joola-stone">{t.claimId}</span>
          </header>
          <div className="flex flex-col gap-2">
            {t.msgs.map((m) => (
              <EmailMessage key={m.id} email={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
