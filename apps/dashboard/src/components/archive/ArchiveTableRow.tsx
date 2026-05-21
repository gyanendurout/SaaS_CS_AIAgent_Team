'use client';

import type { ArchiveRow } from '@/lib/supabase/types';
import { fmtDateTime, fmtDuration } from '@/lib/format';
import { DECISION_CLASS, DECISION_SHORT } from '@/lib/design-tokens';

interface ArchiveTableRowProps {
  row: ArchiveRow;
  onOpen: (id: string) => void;
  onReopen: (id: string) => void;
}

/** One <tr> in the archive table. Click anywhere except the action cell opens the case drawer. */
export function ArchiveTableRow({ row, onOpen, onReopen }: ArchiveTableRowProps) {
  const decClass = DECISION_CLASS[row.decision] ?? 'processing';
  const decShort = DECISION_SHORT[row.decision] ?? row.decision;
  const statusLower = row.status.toLowerCase();

  const action =
    row.status === 'CLOSED' ? (
      <button
        type="button"
        className="tbl-action-btn"
        onClick={() => onReopen(row.id)}
      >
        REOPEN →
      </button>
    ) : row.status === 'OPEN' ? (
      <button
        type="button"
        className="tbl-action-btn"
        onClick={() => onOpen(row.id)}
      >
        VIEW →
      </button>
    ) : (
      <button
        type="button"
        className="tbl-action-btn muted"
        onClick={() => onOpen(row.id)}
      >
        VIEW
      </button>
    );

  return (
    <tr onClick={() => onOpen(row.id)}>
      <td className="mono">{fmtDateTime(row.created_at)}</td>
      <td>
        <span className={`feed__chan ${row.channel}`} style={{ fontSize: 10 }}>
          {row.channel === 'voice' ? '◉' : row.channel === 'email' ? '✉' : '▤'}{' '}
          {row.channel.toUpperCase()}
        </span>
      </td>
      <td className="mono" style={{ color: 'var(--ops-fg)' }}>
        {row.id}
      </td>
      <td>
        {row.customer_name}
        <span className="secondary">
          {row.order_product ?? '—'} ·{' '}
          <span className="mono">{row.order_number ?? '—'}</span>
        </span>
      </td>
      <td>
        <span
          style={{
            fontSize: 11,
            color: 'var(--ops-fg-2)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
        >
          {row.issue}
        </span>
      </td>
      <td>
        <span className={`decision-pill ${decClass}`}>{decShort}</span>
      </td>
      <td>
        <span className={`status-pill ${statusLower}`}>{row.status}</span>
      </td>
      <td className="mono">
        <span style={{ color: row.closed_at ? 'var(--ops-fg)' : 'var(--ops-fg-4)' }}>
          {fmtDateTime(row.closed_at)}
        </span>
      </td>
      <td className="mono">{fmtDuration(row.handle_seconds)}</td>
      <td onClick={(e) => e.stopPropagation()}>{action}</td>
    </tr>
  );
}
