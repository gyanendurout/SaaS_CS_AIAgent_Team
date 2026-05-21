'use client';

import type { Escalation } from '@/lib/supabase/types';

interface EscalationItemProps {
  esc: Escalation;
  customerName: string;
  agentId?: string | null;
  onClaim?: (id: string) => void;
}

const PRIO_LABEL: Record<Escalation['priority'], string> = {
  urgent: 'URGENT',
  high:   'HIGH',
  norm:   'NORM',
};

const AGENT_LABEL: Record<string, string> = {
  intake:   '01 INTAKE',
  shopify:  '02 SHOPIFY',
  warrreg:  '03 WARRANTY',
  rules:    '04 RULES',
  summary:  '05 SUMMARY',
  response: '06 REPLY',
  esc:      '07 ESCALATION',
};

/** One row in the human-escalations queue (right column, bottom). */
export function EscalationItem({ esc, customerName, agentId, onClaim }: EscalationItemProps) {
  const agentLabel = agentId ? AGENT_LABEL[agentId] ?? agentId.toUpperCase() : null;
  return (
    <div className={`esc is-${esc.priority}`}>
      <div className="esc__top">
        <div className="esc__cust">
          {customerName} <em>· <span className="mono">{esc.id}</span></em>
        </div>
        <div className="esc__prio">
          {PRIO_LABEL[esc.priority]} · {esc.wait_minutes}m
        </div>
      </div>
      <div className="esc__reason">{esc.summary}</div>
      <div className="esc__foot">
        <span>
          REASON · {esc.reason}
          {agentLabel && (
            <span style={{ marginLeft: 8, color: 'var(--ops-yellow)' }}>
              · AI · {agentLabel}
            </span>
          )}
        </span>
        <button onClick={() => onClaim?.(esc.id)}>CLAIM →</button>
      </div>
    </div>
  );
}
