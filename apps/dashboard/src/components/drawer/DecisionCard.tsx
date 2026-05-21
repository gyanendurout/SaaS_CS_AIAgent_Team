'use client';

import type { Claim } from '@/lib/supabase/types';

interface DecisionCardProps {
  claim: Claim;
}

const POLICY_VERSION = process.env.NEXT_PUBLIC_POLICY_VERSION ?? '1.0.0';

const MAP: Record<
  Claim['decision'],
  { tone: 'ok' | 'no' | 'review' | ''; label: string; reason: string; next: string }
> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: {
    tone: 'ok',
    label: 'Eligible · damage review',
    reason:
      'Purchase verified, customer is original purchaser, product was purchased from an authorized source, NFC registration was completed within 14 days, and receipt was uploaded and approved.',
    next: 'Ask customer to upload damage photos and a short video.',
  },
  NOT_ELIGIBLE: {
    tone: 'no',
    label: 'Not eligible',
    reason:
      "Purchase source is outside JOOLA's authorized retailer network. Warranty does not apply.",
    next: 'Polite decline · offer human review if disputed.',
  },
  HUMAN_REVIEW_REQUIRED: {
    tone: 'review',
    label: 'Human review required',
    reason:
      'Case requires CS judgment. Common triggers: ambiguous damage, disputed source, replacement limit reached.',
    next: 'Route to CS team · respond within one business day.',
  },
  WARRANTY_EXPIRED: {
    tone: 'no',
    label: 'Warranty expired',
    reason: 'Based on purchase date and registration status, the warranty period has lapsed.',
    next: 'Empathetic decline · offer human review.',
  },
  PROCESSING: {
    tone: '',
    label: 'Processing',
    reason: 'Rule engine has not yet finished evaluating this case.',
    next: 'Awaiting agent handoff.',
  },
};

/**
 * Top of the drawer — surfaces the deterministic rule-engine decision with
 * an authoritative "DETERMINISTIC · v{policy}" stamp. Reason text uses the
 * claim's `citation` if present, otherwise the canonical fallback above.
 */
export function DecisionCard({ claim }: DecisionCardProps) {
  const m = MAP[claim.decision] ?? MAP.PROCESSING;
  return (
    <div className={`decision-card ${m.tone}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow" style={{ color: 'var(--ops-fg-3)' }}>
          Rule engine decision
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--ops-fg-3)', letterSpacing: '.08em' }}
        >
          DETERMINISTIC · v{claim.policy_version || POLICY_VERSION}
        </span>
      </div>
      <div className="verdict" style={{ marginTop: 8 }}>
        {m.label}
      </div>
      <div className="reason">{claim.reason_code ? `${m.reason} (${claim.reason_code})` : m.reason}</div>
      {claim.citation && (
        <div
          className="mono"
          style={{ marginTop: 8, fontSize: 11, color: 'var(--ops-fg-3)' }}
        >
          CITATION · {claim.citation}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px dashed var(--ops-line)',
        }}
      >
        <span className="eyebrow" style={{ color: 'var(--ops-fg-3)' }}>
          Next step
        </span>
        <div style={{ fontSize: 12, color: 'var(--ops-fg)', marginTop: 4 }}>{m.next}</div>
      </div>
    </div>
  );
}
