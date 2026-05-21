import { getServerSupabase } from '@/lib/supabase/server';
import { KPIStrip } from '@/components/live/KPIStrip';
import { AgentTeam } from '@/components/live/AgentTeam';
import { ActiveCalls } from '@/components/live/ActiveCalls';
import { LiveFeed } from '@/components/live/LiveFeed';
import { Pipeline } from '@/components/live/Pipeline';
import { Escalations } from '@/components/live/Escalations';
import { VolumeChart } from '@/components/live/VolumeChart';
import type {
  Agent,
  AgentState,
  DashboardKpi,
  DecisionMixRow,
  PipelineStageRow,
} from '@/lib/supabase/types';

// Live dashboard — no caching whatsoever.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * RSC entry for /live. Pre-fetches the four "first paint" shapes so the
 * client islands hydrate with real data instead of zero-state. After
 * hydration each client component manages its own Realtime subscription.
 */
export default async function LivePage() {
  const supabase = getServerSupabase();

  const [agentsRes, statesRes, kpiRes, pipeRes, mixRes] = await Promise.all([
    supabase.from('agents').select('*').order('id'),
    supabase.from('agent_states').select('*'),
    // Views are typed as `any` from the client SDK side.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('dashboard_kpi' as any).select('*').limit(1).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('claim_pipeline_summary' as any).select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('decision_mix_today' as any).select('*'),
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const states = (statesRes.data ?? []) as AgentState[];
  const kpi = (kpiRes.data ?? null) as DashboardKpi | null;
  const pipeline = (pipeRes.data ?? []) as PipelineStageRow[];
  const mix = (mixRes.data ?? []) as DecisionMixRow[];

  return (
    <div className="view-live">
      <KPIStrip initial={kpi} />
      <div className="main">
        <div className="col">
          <AgentTeam initialAgents={agents} initialStates={states} />
          <div className="minicharts" style={{ borderTop: '1px solid var(--ops-line)', background: 'var(--ops-panel)' }}>
            <VolumeChart />
          </div>
        </div>
        <div className="col center">
          <ActiveCalls />
          <LiveFeed />
        </div>
        <div className="col right">
          <Pipeline initialStages={pipeline} initialMix={mix} />
          <Escalations />
        </div>
      </div>
    </div>
  );
}
