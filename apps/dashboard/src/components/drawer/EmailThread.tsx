'use client';

import { fmtDateTime } from '@/lib/format';
import type { CaseEmail } from '@/lib/api/cases';

interface EmailThreadProps {
  emails: CaseEmail[];
}

/**
 * Renders the full inbound/outbound email exchange for a claim in
 * chronological order. The first inbound email is the original customer
 * report with full sender info. Subsequent rows are AI/CS replies and any
 * customer follow-ups, forming the case's conversation history.
 */
export function EmailThread({ emails }: EmailThreadProps) {
  if (!emails || emails.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--ops-fg-3)',
          padding: 12,
          border: '1px dashed var(--ops-line)',
        }}
      >
        No email correspondence on file for this case.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {emails.map((e, idx) => {
        const isInbound = e.direction === 'inbound';
        return (
          <div
            key={e.id}
            style={{
              border: '1px solid var(--ops-line)',
              borderLeft: `3px solid ${isInbound ? 'var(--ops-blue)' : 'var(--ops-green)'}`,
              background: isInbound ? 'var(--ops-panel-2)' : 'var(--ops-panel)',
              padding: '10px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <div>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: isInbound ? 'var(--ops-blue)' : 'var(--ops-green)',
                    fontWeight: 700,
                  }}
                >
                  {isInbound ? '↓ INBOUND' : '↑ OUTBOUND'} · TURN {idx + 1}
                </span>
              </div>
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}
              >
                {fmtDateTime(e.sent_at)}
              </span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ops-fg-2)' }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--ops-fg-3)' }}>From: </span>
                <span className="mono">{e.from_addr}</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--ops-fg-3)' }}>To: </span>
                <span className="mono">{e.to_addr}</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--ops-fg-3)' }}>Subject: </span>
                <b style={{ color: 'var(--ops-fg)' }}>{e.subject}</b>
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  color: 'var(--ops-fg)',
                  padding: '8px 10px',
                  background: 'var(--ops-bg)',
                  borderLeft: '2px solid var(--ops-line-2)',
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                {e.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
