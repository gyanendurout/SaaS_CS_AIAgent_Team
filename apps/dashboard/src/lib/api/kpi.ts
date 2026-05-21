'use client';

import { getBrowserSupabase } from '@/lib/supabase/client';
import type { DashboardKpi, DecisionMixRow } from '@/lib/supabase/types';

/** Reads the dashboard_kpi view (one row). */
export async function fetchDashboardKpi(): Promise<DashboardKpi | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    // The view is registered in Database['public']['Views'] in types.ts but
    // PostgREST types are erased to `any` at the supabase-js boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('dashboard_kpi' as any)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`dashboard_kpi failed: ${error.message}`);
  return (data ?? null) as DashboardKpi | null;
}

/** Reads decision_mix_today view (zero+ rows, one per decision present). */
export async function fetchDecisionMixToday(): Promise<DecisionMixRow[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('decision_mix_today' as any)
    .select('*');

  if (error) throw new Error(`decision_mix_today failed: ${error.message}`);
  return (data ?? []) as DecisionMixRow[];
}
