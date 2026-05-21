'use client';

import type { Agent, AgentState } from '@/lib/supabase/types';

interface AgentRowProps {
  agent: Agent;
  state: AgentState;
  selected?: boolean;
  onClick?: () => void;
}

const STATE_LABEL: Record<AgentState['state'], string> = {
  idle: 'IDLE',
  busy: 'PROCESSING',
  blocked: 'BLOCKED',
  error: 'ERROR',
};

/**
 * One row in the left-column agent list. Status dot / bar / current task
 * are all driven by agent_states (live-updated via Realtime).
 */
export function AgentRow({ agent, state, selected = false, onClick }: AgentRowProps) {
  return (
    <div
      className={`agent is-${state.state} ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
    >
      <div className="agent__top">
        <div className="agent__name">
          <span className="glyph">{agent.glyph}</span>
          {agent.name}
        </div>
        <div className="agent__status">
          <span className="status-dot" />
          {STATE_LABEL[state.state]}
        </div>
      </div>
      <div className="agent__meta">
        <span>Queue <b>{state.queue_depth}</b></span>
        <span>Handled <b>{state.handled_today}</b></span>
        <span>Avg <b>{state.avg_ms}ms</b></span>
        <span>Load <b>{state.load_pct}%</b></span>
      </div>
      <div className="agent__bar">
        <i style={{ width: `${state.load_pct}%` }} />
      </div>
      <div className="agent__task">
        {state.state === 'idle' ? (
          <span style={{ color: 'var(--ops-fg-4)' }}>Awaiting work…</span>
        ) : (
          <span>
            On <code>{state.current_task_for ?? '—'}</code> · {agent.role}
          </span>
        )}
      </div>
    </div>
  );
}
