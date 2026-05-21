'use client';

import { useMemo } from 'react';
import type { Agent, AgentId, CaseEvent, Claim } from '@/lib/supabase/types';

interface TimelineProps {
  claim: Claim;
  events: CaseEvent[];
  /** Optional pre-fetched agent metadata (id → row); falls back to constants. */
  agents?: Agent[];
}

interface Step {
  id: AgentId;
  glyph: string;
  name: string;
  role: string;
  status: 'done' | 'current' | 'pending' | 'error';
  time: string;
  io?: { in: string; out: string };
}

const FALLBACK_AGENTS: Array<{ id: AgentId; glyph: string; name: string; role: string }> = [
  { id: 'intake',   glyph: '01', name: 'Intake',          role: 'Receives + classifies inquiry' },
  { id: 'shopify',  glyph: '02', name: 'Shopify Verify',  role: 'Looks up purchase in Shopify' },
  { id: 'warrreg',  glyph: '03', name: 'Warranty Reg',    role: 'Checks NFC registration DB' },
  { id: 'rules',    glyph: '04', name: 'Rule Engine',     role: 'Applies deterministic policy' },
  { id: 'summary',  glyph: '05', name: 'Claim Summary',   role: 'Builds claim record + summary' },
  { id: 'response', glyph: '06', name: 'Customer Reply',  role: 'Drafts email + voice reply' },
  { id: 'esc',      glyph: '07', name: 'Human Escalation', role: 'Hands off to CS team' },
];

const STAGE_MAP: Record<string, number> = {
  intake: 0,
  verify: 2,
  rules: 3,
  draft: 5,
  closed: 6,
};

/**
 * Renders the 7-agent journey for a claim. Live events from `case_events`
 * (with an `actor_id` matching an agent id) snap each step to "done" with
 * a real timestamp; absent that, the claim's `stage` drives the cursor.
 */
export function Timeline({ claim, events, agents }: TimelineProps) {
  const steps = useMemo<Step[]>(() => {
    const list = agents && agents.length > 0
      ? agents
      : (FALLBACK_AGENTS as unknown as Agent[]);

    const eventsByAgent = new Map<AgentId, CaseEvent[]>();
    for (const ev of events) {
      const aid = (ev.actor_id ?? '') as AgentId;
      if (!aid) continue;
      const arr = eventsByAgent.get(aid) ?? [];
      arr.push(ev);
      eventsByAgent.set(aid, arr);
    }

    const cursor = STAGE_MAP[claim.stage] ?? 6;

    return list.map((agent, i) => {
      const evts = eventsByAgent.get(agent.id) ?? [];
      const last = evts[evts.length - 1];

      let status: Step['status'];
      if (last) {
        status = 'done';
      } else if (i < cursor) {
        status = 'done';
      } else if (i === cursor) {
        status = 'current';
      } else {
        status = 'pending';
      }

      // Escalation row should be "current" only when decision routed there.
      if (agent.id === 'esc' && claim.decision === 'HUMAN_REVIEW_REQUIRED') {
        status = 'current';
      }

      const time = last
        ? new Date(last.created_at).toLocaleTimeString('en-US', { hour12: false })
        : status === 'pending'
          ? '—'
          : 'recent';

      const io = last
        ? {
            in: JSON.stringify(last.payload?.input ?? last.payload).slice(0, 80),
            out: JSON.stringify(last.payload?.output ?? last.event_type).slice(0, 80),
          }
        : undefined;

      return {
        id: agent.id,
        glyph: agent.glyph,
        name: agent.name,
        role: agent.role,
        status,
        time,
        io,
      };
    });
  }, [agents, claim.decision, claim.stage, events]);

  return (
    <div className="timeline">
      {steps.map((s) => (
        <div key={s.id} className={`tl-step is-${s.status}`}>
          <div className="rail">
            <div className="dot" />
          </div>
          <div className="card">
            <div className="name">
              <span>
                {s.glyph} · {s.name}
              </span>
              <span className="time">{s.status === 'pending' ? 'PENDING' : s.time}</span>
            </div>
            <div className="desc">{s.role}</div>
            {s.io && (
              <div className="io">
                <div>→ <b>in:</b> {s.io.in}</div>
                <div>← <b>out:</b> {s.io.out}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
