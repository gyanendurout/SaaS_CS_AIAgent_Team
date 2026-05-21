'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DecisionCard } from './DecisionCard';
import { Timeline } from './Timeline';
import { DraftsSection } from './DraftsSection';
import { EmailThread } from './EmailThread';
import { ReopenModal } from './ReopenModal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { fetchCase, fetchCaseTimeline, type CaseDetail } from '@/lib/api/cases';
import type { CaseEvent } from '@/lib/supabase/types';
import { fmtDateTime } from '@/lib/format';

const CHANNEL_LABEL: Record<string, string> = {
  voice: 'PHONE CALL',
  email: 'EMAIL',
  web: 'WEB FORM',
};

/**
 * URL-driven case detail drawer. Reads `?case=WC-XXXXX` from the search
 * params; if absent, renders an empty drawer scrim (no-op). Closing the
 * drawer just removes the `case` param — deep-linkable + shareable.
 */
export function CaseDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams?.get('case') ?? null;

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  // Load case + events when case id changes.
  const reload = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [d, e] = await Promise.all([fetchCase(caseId), fetchCaseTimeline(caseId)]);
      setDetail(d);
      setEvents(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!caseId) {
      setDetail(null);
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [d, e] = await Promise.all([fetchCase(caseId), fetchCaseTimeline(caseId)]);
        if (cancelled) return;
        setDetail(d);
        setEvents(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const close = () => {
    if (!searchParams) {
      router.replace(typeof window !== 'undefined' ? window.location.pathname : '/');
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete('case');
    const qs = next.toString();
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    router.replace(qs ? `${path}?${qs}` : path);
  };

  const open = Boolean(caseId);
  const c = detail?.claim;
  const isArchived = c?.display_status === 'CLOSED' || c?.display_status === 'REOPENED';

  return (
    <>
      <div className={`drawer-scrim ${open ? 'is-open' : ''}`} onClick={close} />
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        {detail && c && (
          <>
            <div className="drawer__hdr">
              <div>
                <div className="id mono">
                  CASE {c.id} · {CHANNEL_LABEL[c.channel] ?? c.channel.toUpperCase()}
                  {isArchived && (
                    <Chip className="ml-2">ARCHIVED · {c.display_status}</Chip>
                  )}
                </div>
                <h2>{detail.customer.name}</h2>
                <div className="sub">
                  <span className="mono">{detail.customer.email}</span> · {detail.customer.country}
                  {detail.customer.phone && (
                    <>
                      {' '}
                      · <span className="mono">{detail.customer.phone}</span>
                    </>
                  )}{' '}
                  · opened <span className="mono">{fmtDateTime(c.created_at)}</span>
                  {c.closed_at && (
                    <>
                      {' '}
                      · closed <span className="mono">{fmtDateTime(c.closed_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {isArchived && (
                  <Button variant="primary" onClick={() => setReopenOpen(true)}>
                    Reopen → Live
                  </Button>
                )}
                <button
                  className="drawer__close"
                  onClick={close}
                  title="Close"
                  aria-label="Close case drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer__body">
              {c.channel === 'email' && detail.emails && detail.emails.length > 0 && (
                <div className="section">
                  <div className="section__h">
                    <span className="eyebrow">Email correspondence</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
                    >
                      {detail.emails.length} MESSAGE{detail.emails.length === 1 ? '' : 'S'}
                    </span>
                  </div>
                  <EmailThread emails={detail.emails} />
                </div>
              )}

              {c.channel === 'voice' && detail.transcripts && detail.transcripts.length > 0 && (
                <div className="section">
                  <div className="section__h">
                    <span className="eyebrow">Call transcript</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
                    >
                      {detail.transcripts.length} LINE{detail.transcripts.length === 1 ? '' : 'S'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      maxHeight: 280,
                      overflowY: 'auto',
                      padding: '6px 0',
                    }}
                  >
                    {detail.transcripts.map((line) => (
                      <div
                        key={line.id}
                        style={{
                          display: 'flex',
                          gap: 8,
                          fontSize: 12,
                          lineHeight: 1.45,
                          padding: '2px 0',
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            minWidth: 38,
                            fontSize: 10,
                            color: line.who === 'CUSTOMER'
                              ? 'var(--ops-yellow)'
                              : 'var(--ops-fg-3)',
                            flexShrink: 0,
                            paddingTop: 1,
                          }}
                        >
                          {line.who === 'CUSTOMER' ? 'CUST' : 'AI ▸'}
                        </span>
                        <span style={{ color: 'var(--ops-fg)', flex: 1 }}>{line.txt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="section">
                <div className="section__h">
                  <span className="eyebrow">Issue reported</span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--ops-fg)',
                    lineHeight: 1.5,
                    padding: '10px 12px',
                    background: 'var(--ops-bg)',
                    border: '1px solid var(--ops-line)',
                  }}
                >
                  &ldquo;{c.issue}&rdquo;
                </div>
              </div>

              <div className="section">
                <DecisionCard claim={c} />
              </div>

              {detail.order && (
                <div className="section">
                  <div className="section__h">
                    <span className="eyebrow">Purchase + registration</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
                    >
                      VERIFIED · READ-ONLY
                    </span>
                  </div>
                  <dl className="kv">
                    <dt>Order #</dt>
                    <dd className="mono">{detail.order.order_number}</dd>
                    <dt>Product</dt>
                    <dd>{detail.order.product_name}</dd>
                    <dt>SKU</dt>
                    <dd className="mono">{detail.order.product_sku}</dd>
                    <dt>Purchase date</dt>
                    <dd className="mono">{detail.order.purchase_date}</dd>
                    <dt>Source</dt>
                    <dd>
                      {detail.order.source}{' '}
                      {detail.order.authorized ? (
                        <Chip tone="yellow" className="ml-2">AUTHORIZED</Chip>
                      ) : (
                        <Chip tone="red" className="ml-2">UNAUTHORIZED</Chip>
                      )}
                    </dd>
                    {detail.registration && (
                      <>
                        <dt>NFC registered</dt>
                        <dd>
                          {detail.registration.registered ? (
                            <>
                              Yes ·{' '}
                              <span className="mono">{detail.registration.nfc_id ?? '—'}</span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--ops-fg-3)' }}>Not found</span>
                          )}
                        </dd>
                        <dt>Within 14 days?</dt>
                        <dd>
                          {detail.registration.registered
                            ? detail.registration.within_window
                              ? 'Yes'
                              : (
                                  <span style={{ color: 'var(--ops-orange)' }}>No · late</span>
                                )
                            : '—'}
                        </dd>
                        <dt>Receipt approved</dt>
                        <dd>
                          {detail.registration.receipt_approved ? 'Yes' : 'Pending'}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              )}

              <div className="section">
                <div className="section__h">
                  <span className="eyebrow">Agent journey</span>
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
                  >
                    7 AGENTS · 1 PIPELINE
                  </span>
                </div>
                <Timeline claim={c} events={events} />
              </div>

              <div className="section">
                <div className="section__h">
                  <span className="eyebrow">AI drafts · awaiting CS review</span>
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
                  >
                    NOT SENT
                  </span>
                </div>
                <DraftsSection
                  claimId={c.id}
                  draft={detail.drafts}
                  channel={c.channel}
                  isArchived={isArchived}
                  onChanged={() => void reload()}
                />
              </div>
            </div>
          </>
        )}
        {open && loading && !detail && (
          <div
            style={{
              flex: 1,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--ops-fg-3)',
            }}
          >
            <div className="mono text-[11px] tracking-[0.16em] uppercase">Loading case…</div>
          </div>
        )}
        {open && !loading && !detail && (
          <div
            style={{
              flex: 1,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--ops-fg-3)',
            }}
          >
            <div className="text-center">
              <div className="display-num text-[22px] uppercase">Case not found</div>
              <button
                className="mt-4 underline"
                onClick={close}
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </aside>

      <ReopenModal
        open={reopenOpen}
        claimId={caseId}
        onClose={() => setReopenOpen(false)}
      />
    </>
  );
}
