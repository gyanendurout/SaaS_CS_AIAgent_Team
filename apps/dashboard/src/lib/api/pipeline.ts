'use client';

import { getBrowserSupabase } from '@/lib/supabase/client';
import type { PipelineStageRow } from '@/lib/supabase/types';

const STAGE_ORDER: PipelineStageRow['stage'][] = [
  'intake', 'verify', 'rules', 'draft', 'closed',
];

/** Reads claim_pipeline_summary view; guarantees all 5 stages in deterministic order. */
export async function fetchPipelineSummary(): Promise<PipelineStageRow[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('claim_pipeline_summary' as any)
    .select('*');

  if (error) throw new Error(`claim_pipeline_summary failed: ${error.message}`);

  const byStage = new Map<string, PipelineStageRow>();
  for (const row of (data ?? []) as PipelineStageRow[]) {
    byStage.set(row.stage, row);
  }
  return STAGE_ORDER.map((stage) => byStage.get(stage) ?? { stage, count: 0, stuck_count: 0 });
}
