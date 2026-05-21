'use client';

import { fmtTime } from '@/lib/format';
import { DECISION_CLASS, DECISION_SHORT } from '@/lib/design-tokens';
import type { AgentId, ChannelType, DecisionType } from '@/lib/supabase/types';

interface FeedRowProps {
  id: string;
  channel: ChannelType;
  customerName: string;
  productName: string | null;
  createdAt: string;
  decision: DecisionType;
  stage: string;
  statusDetail?: string | null;
  displayStatus?: string | null;
  isNew?: boolean;
  onOpen?: (id: string) => void;
}

const STAGE_TO_AGENT: Record<string, { id: AgentId; name: string; glyph: string }> = {
  intake:  { id: 'intake',   name: 'Intake',          glyph: '01' },
  verify:  { id: 'shopify',  name: 'Shopify Verify',  glyph: '02' },
  rules:   { id: 'rules',    name: 'Rule Engine',     glyph: '04' },
  draft:   { id: 'response', name: 'Customer Reply',  glyph: '06' },
  closed:  { id: 'esc',      name: '—',               glyph: '—' },
};

function channelGlyph(channel: ChannelType): string {
  if (channel === 'voice') return '◉ VOICE';
  if (channel === 'email') return '✉ EMAIL';
  return '▤ WEB';
}

/**
 * Email-channel state tag overrides the rule-engine decision so the CS team
 * can see at-a-glance whether a case needs their attention.
 */
function emailStateTag(
  stage: string,
  statusDetail: string | null | undefined,
  displayStatus: string | null | undefined,
): { label: string; cls: string } | null {
  if (statusDetail === 'DRAFT_PENDING_APPROVAL' || stage === 'draft') {
    return { label: 'AWAITING CS', cls: 'review' };
  }
  if (statusDetail === 'AWAITING_CUSTOMER_REPLY') {
    return { label: 'AWAITING REPLY', cls: 'waiting' };
  }
  if (statusDetail === 'REOPENED' || displayStatus === 'REOPENED') {
    return { label: 'CHAIN · NEW REPLY', cls: 'processing' };
  }
  if (stage === 'closed' && displayStatus === 'CLOSED') {
    return { label: 'REPLIED · CLOSED', cls: 'eligible' };
  }
  if (stage === 'esc') {
    return { label: 'ESCALATED', cls: 'review' };
  }
  return null;
}

/** Single row in the LiveFeed. URL-deeplinks to the case drawer on click. */
export function FeedRow({
  id,
  channel,
  customerName,
  productName,
  createdAt,
  decision,
  stage,
  statusDetail,
  displayStatus,
  isNew,
  onOpen,
}: FeedRowProps) {
  const agent = STAGE_TO_AGENT[stage] ?? STAGE_TO_AGENT.intake;
  const decClass = DECISION_CLASS[decision] ?? 'processing';
  const decShort = DECISION_SHORT[decision] ?? decision;
  const emailTag = channel === 'email' ? emailStateTag(stage, statusDetail, displayStatus) : null;

  const statusCls = emailTag?.cls ?? decClass;
  const statusLabel = emailTag?.label ?? decShort;

  // Row background tint for email channel so CS can spot pending work fast.
  const rowStyle: React.CSSProperties = {};
  if (channel === 'email') {
    if (statusDetail === 'DRAFT_PENDING_APPROVAL' || stage === 'draft') {
      rowStyle.borderLeft = '3px solid var(--ops-orange)';
    } else if (statusDetail === 'AWAITING_CUSTOMER_REPLY') {
      rowStyle.borderLeft = '3px solid var(--ops-purple, #8b5cf6)';
    } else if (statusDetail === 'REOPENED' || displayStatus === 'REOPENED') {
      rowStyle.borderLeft = '3px solid var(--ops-blue)';
    } else if (stage === 'closed') {
      rowStyle.borderLeft = '3px solid var(--ops-green)';
    } else if (stage === 'esc') {
      rowStyle.borderLeft = '3px solid var(--ops-red)';
    }
  }

  return (
    <div
      className={`feed__row ${isNew ? 'is-new' : ''}`}
      style={rowStyle}
      onClick={() => onOpen?.(id)}
    >
      <span className="feed__time mono">{fmtTime(createdAt)}</span>
      <span className={`feed__chan ${channel}`}>{channelGlyph(channel)}</span>
      <span className="feed__cust">
        {customerName} <em>· {productName ?? 'No product'}</em>
      </span>
      <span className="feed__id mono">{id}</span>
      <span className="feed__agent">
        {agent ? (
          <>
            <span className="glyph">{agent.glyph}</span> {agent.name}
          </>
        ) : (
          <span style={{ color: 'var(--ops-fg-4)' }}>—</span>
        )}
      </span>
      <span className={`feed__status ${statusCls}`}>{statusLabel}</span>
    </div>
  );
}
