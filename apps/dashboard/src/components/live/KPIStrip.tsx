'use client';

import { useEffect, useMemo, useState } from 'react';
import { KPI } from './KPI';
import { fetchDashboardKpi } from '@/lib/api/kpi';
import { subscribeToTable } from '@/lib/supabase/realtime';
import { fmtMinSec } from '@/lib/format';
import type { DashboardKpi } from '@/lib/supabase/types';

interface KPIStripProps {
  initial?: DashboardKpi | null;
}

/**
 * 7-tile KPI header. Initial values come from the server (RSC fetch) for
 * instant first paint; we then refetch whenever a claim changes so the
 * numbers stay live without burning subscriptions on the view directly
 * (Postgres views aren't in the Realtime publication).
 */
export function KPIStrip({ initial }: KPIStripProps) {
  const [kpi, setKpi] = useState<DashboardKpi | null>(initial ?? null);

  // Refetch the view whenever a claim row changes — cheap enough at our
  // expected volume and avoids us having to re-derive the view client-side.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await fetchDashboardKpi();
        if (!cancelled) setKpi(next);
      } catch {
        /* swallow — view will refresh on next event */
      }
    };
    if (!initial) void refresh();
    const off = subscribeToTable('claims', () => void refresh());
    return () => {
      cancelled = true;
      off();
    };
  }, [initial]);

  // Sparklines are deterministic per mount — not realtime — so we generate
  // once and keep them stable rather than thrashing.
  const sparks = useMemo(
    () =>
      Array.from({ length: 6 }, () =>
        Array.from({ length: 12 }, () => Math.random() * 10 + 3),
      ),
    [],
  );

  const k = kpi ?? {
    calls_today: 0, emails_today: 0, web_forms_today: 0,
    open_claims: 0, auto_resolve_pct: 0, avg_handle_seconds: 0,
    escalations_count: 0, sla_breach_count: 0,
  };

  return (
    <div className="kpis">
      <KPI label="Calls today"   value={k.calls_today}     delta="live"   deltaDir="flat" sparkData={sparks[0]} />
      <KPI label="Emails today"  value={k.emails_today}    delta="live"   deltaDir="flat" sparkData={sparks[1]} />
      <KPI label="Web forms"     value={k.web_forms_today} delta="live"   deltaDir="flat" sparkData={sparks[2]} />
      <KPI label="Open claims"   value={k.open_claims}     delta="active" deltaDir="flat" sparkData={sparks[3]} accent />
      <KPI label="Auto-resolved" value={k.auto_resolve_pct} unit="%"      delta="today"  deltaDir="up"   sparkData={sparks[4]} />
      <KPI label="Avg handle"    value={fmtMinSec(k.avg_handle_seconds)}  delta="today"  deltaDir="flat" sparkData={sparks[5]} />
      <KPI
        label="Escalations"
        value={k.escalations_count}
        delta={`${k.sla_breach_count} SLA breach`}
        deltaDir="down"
        danger
      />
    </div>
  );
}
