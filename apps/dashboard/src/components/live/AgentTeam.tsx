'use client';

import { useEffect, useMemo, useState } from 'react';
import { AgentRow } from './AgentRow';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';
import type { Agent, AgentId, AgentState } from '@/lib/supabase/types';

interface AgentTeamProps {
  initialAgents?: Agent[];
  initialStates?: AgentState[];
}

/**
 * Left column. Two parallel data sources:
 *   - `agents` table  → static metadata (id, name, glyph, role) loaded once
 *   - `agent_states` → live per-agent state, subscribed to via Realtime
 *
 * We index states by agent_id so an UPDATE event can patch a single row
 * without re-rendering the whole list.
 */
export function AgentTeam({ initialAgents = [], initialStates = [] }: AgentTeamProps) {
  const supabase = useSupabase();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [states, setStates] = useState<Map<AgentId, AgentState>>(() => {
    const m = new Map<AgentId, AgentState>();
    for (const s of initialStates) m.set(s.agent_id, s);
    return m;
  });
  const [selected, setSelected] = useState<AgentId | null>(null);

  // Cold-start: if SSR didn't pass initials, fetch them now.
  useEffect(() => {
    let cancelled = false;
    const cold = async () => {
      if (agents.length === 0) {
        const { data } = await supabase.from('agents').select('*').order('id');
        if (!cancelled && data) setAgents(data as Agent[]);
      }
      if (states.size === 0) {
        const { data } = await supabase.from('agent_states').select('*');
        if (!cancelled && data) {
          const m = new Map<AgentId, AgentState>();
          for (const s of data as AgentState[]) m.set(s.agent_id, s);
          setStates(m);
        }
      }
    };
    void cold();
    return () => {
      cancelled = true;
    };
    // initial fetch — intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: any agent_states change → patch the map.
  useEffect(() => {
    const off = subscribeToTable<AgentState>('agent_states', (payload) => {
      if (payload.eventType === 'DELETE') return;
      const next = (payload.new ?? null) as AgentState | null;
      if (!next) return;
      setStates((prev) => {
        const m = new Map(prev);
        m.set(next.agent_id, next);
        return m;
      });
    });
    return off;
  }, []);

  const busy = useMemo(
    () => Array.from(states.values()).filter((s) => s.state === 'busy').length,
    [states],
  );

  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          AI Agent Team
          <span className="count mono">
            {busy}/{agents.length} ACTIVE
          </span>
        </div>
        <div className="panel__hdr-actions">
          <button className="icon-btn" title="Refresh" aria-label="Refresh">↻</button>
        </div>
      </div>
      <div className="panel__body">
        <div className="agent-list">
          {agents.map((a) => {
            const state =
              states.get(a.id) ??
              ({
                agent_id: a.id,
                state: 'idle',
                queue_depth: 0,
                handled_today: 0,
                avg_ms: 0,
                load_pct: 0,
                current_task_for: null,
                updated_at: new Date().toISOString(),
              } satisfies AgentState);
            return (
              <AgentRow
                key={a.id}
                agent={a}
                state={state}
                selected={selected === a.id}
                onClick={() => setSelected(a.id === selected ? null : a.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
