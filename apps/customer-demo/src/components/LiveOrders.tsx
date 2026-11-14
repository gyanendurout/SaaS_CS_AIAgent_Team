'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchLiveOrders, isFullEmail, type LiveOrder } from '@/lib/api/live-orders';
import { cx } from '@/lib/format';

type State =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'error' }
  | { kind: 'ready'; orders: LiveOrder[] };

const LIMIT = 9;

function label(value: string | null): string {
  return (value ?? 'unknown').replace(/_/g, ' ').toLowerCase();
}

function statusTone(o: LiveOrder): string {
  if (o.cancelled) return 'bg-rose-50 text-rose-700';
  if (o.returns.length) return 'bg-amber-50 text-amber-700';
  if (o.fulfillment_status === 'FULFILLED') return 'bg-emerald-50 text-emerald-700';
  return 'bg-joola-fog text-joola-graphite';
}

function script(o: LiveOrder): string {
  const email = isFullEmail(o.email_hint) ? ` My email is ${o.email_hint}.` : '';
  return `Hi, can you tell me the status of my order ${o.order_number}?${email}`;
}

export function LiveOrders() {
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetchLiveOrders(LIMIT, signal);
      if (!res.enabled) setState({ kind: res.error ? 'error' : 'off' });
      else if (res.error) setState({ kind: 'error' });
      else setState({ kind: 'ready', orders: res.orders });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const onCopy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      // clipboard can be blocked — non-critical
    }
  }, []);

  return (
    <section className="mx-auto mt-4 max-w-6xl px-6 pb-8" aria-labelledby="live-orders-title">
      <div className="overflow-hidden rounded border border-joola-fog bg-joola-paper">
        <div className="flex w-full items-center justify-between gap-3 border-b border-joola-fog bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <span className="rounded-pill bg-joola-yellow px-2 py-0.5 font-mono text-[10px] uppercase tracking-mega text-joola-black">
              Live Shopify
            </span>
            <span id="live-orders-title" className="font-sans text-sm font-bold uppercase tracking-tight text-joola-black">
              Order status — real sandbox orders
            </span>
            <span className="hidden text-xs text-joola-stone sm:inline">
              Ask about one of these on a call; the agent checks the email on the order
            </span>
          </button>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={state.kind === 'loading'}
              className="min-h-[32px] rounded-sm border border-joola-fog px-2 font-mono text-[10px] uppercase tracking-mega text-joola-graphite hover:border-joola-black disabled:opacity-50"
            >
              {state.kind === 'loading' ? 'Loading…' : 'Refresh'}
            </button>
            <span aria-hidden className="font-mono text-xs text-joola-stone">
              {open ? '▾' : '▸'}
            </span>
          </span>
        </div>

        {open && (
          <div className="p-3" aria-live="polite" aria-busy={state.kind === 'loading'}>
            {state.kind === 'loading' && (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading live orders">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="h-36 animate-pulse rounded-sm border border-joola-fog bg-white motion-reduce:animate-none" />
                ))}
              </ul>
            )}
            {state.kind === 'off' && (
              <p className="px-2 py-3 text-xs text-joola-graphite">
                Live orders are switched off on the server (ORDER_SOURCE=off).
              </p>
            )}
            {state.kind === 'error' && (
              <p className="px-2 py-3 text-xs text-rose-700">
                Couldn’t load live orders right now. Try Refresh in a moment.
              </p>
            )}
            {state.kind === 'ready' && state.orders.length === 0 && (
              <p className="px-2 py-3 text-xs text-joola-graphite">No orders in the sandbox store yet.</p>
            )}
            {state.kind === 'ready' && state.orders.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {state.orders.map((o) => {
                  const key = o.order_number ?? '';
                  const tracked = o.shipments.find((s) => s.tracking_url || s.tracking_number);
                  return (
                    <li key={key} className="flex flex-col gap-2 rounded-sm border border-joola-fog bg-white p-3">
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="font-sans text-xs font-bold uppercase tracking-tight text-joola-black">
                          Order {o.order_number}
                        </span>
                        <span className={cx('shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide', statusTone(o))}>
                          {o.cancelled ? 'cancelled' : label(o.fulfillment_status)}
                        </span>
                      </span>
                      <dl className="grid w-full grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5">
                        <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Placed</dt>
                        <dd className="font-mono text-[10px] text-joola-black">{o.placed_on ?? '—'}</dd>
                        <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Payment</dt>
                        <dd className="font-mono text-[10px] text-joola-black">{label(o.payment_status)}</dd>
                        <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Items</dt>
                        <dd className="line-clamp-2 font-mono text-[10px] text-joola-black">
                          {o.items.length ? o.items.map((i) => `${i.quantity ?? 1}× ${i.title ?? 'item'}`).join(', ') : '—'}
                        </dd>
                        <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Shipping</dt>
                        <dd className="font-mono text-[10px] text-joola-black">
                          {tracked ? (
                            <>
                              {tracked.carrier ?? 'carrier'}{' '}
                              {tracked.tracking_url ? (
                                <a
                                  href={tracked.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-joola-graphite"
                                >
                                  track
                                </a>
                              ) : (
                                tracked.tracking_number
                              )}
                            </>
                          ) : (
                            'no tracking yet'
                          )}
                        </dd>
                        {o.returns.length > 0 && (
                          <>
                            <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Returns</dt>
                            <dd className="font-mono text-[10px] text-joola-black">
                              {o.returns.map((r) => label(r.status)).join(', ')}
                            </dd>
                          </>
                        )}
                        <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Email</dt>
                        <dd className="break-all font-mono text-[10px] text-joola-black">{o.email_hint ?? '—'}</dd>
                      </dl>
                      {!isFullEmail(o.email_hint) && (
                        <span className="text-[10px] text-joola-stone">
                          Email hidden — use your own order or a staff test order to pass the check.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void onCopy(key, script(o))}
                        aria-label={`Copy call script for order ${o.order_number}`}
                        className={cx(
                          'mt-auto min-h-[32px] self-start rounded-sm border border-joola-fog px-2 font-mono text-[10px] uppercase tracking-mega hover:border-joola-black',
                          copied === key ? 'text-joola-court-green' : 'text-joola-graphite',
                        )}
                      >
                        {copied === key ? 'Copied!' : 'Copy call script'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
