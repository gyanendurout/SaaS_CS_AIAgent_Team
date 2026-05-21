'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EscalationItem } from './EscalationItem';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';
import type { Claim, Customer, Escalation } from '@/lib/supabase/types';

interface JoinedEsc {
  esc: Escalation;
  customerName: string;
  agentId: string | null;
}

const PRIO_ORDER: Record<Escalation['priority'], number> = {
  urgent: 0,
  high: 1,
  norm: 2,
};

/**
 * Right-column bottom panel. Pulls the escalations table joined to customer
 * via claim (the escalation id IS the claim id). Subscribes to INSERT and
 * UPDATE events so claimed/declared escalations re-render.
 */
export function Escalations() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<JoinedEsc[]>([]);

  const load = async () => {
    const { data: escs } = await supabase
      .from('escalations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!escs || escs.length === 0) {
      setItems([]);
      return;
    }
    const escRows = escs as Escalation[];
    const ids = escRows.map((e) => e.id);
    const { data: claims } = await supabase
      .from('claims')
      .select('id,customer_id,primary_agent_id')
      .in('id', ids);
    type ClaimLite = Pick<Claim, 'id' | 'customer_id'> & { primary_agent_id: string | null };
    const claimRows = (claims ?? []) as ClaimLite[];
    const custIds = Array.from(new Set(claimRows.map((c) => c.customer_id)));
    const { data: customers } = await supabase
      .from('customers')
      .select('id,name')
      .in('id', custIds);
    const custByClaim = new Map<string, string>();
    const agentByClaim = new Map<string, string | null>();
    const custMap = new Map<string, string>();
    for (const c of (customers ?? []) as { id: string; name: string }[]) custMap.set(c.id, c.name);
    for (const cl of claimRows) {
      custByClaim.set(cl.id, custMap.get(cl.customer_id) ?? 'Unknown');
      agentByClaim.set(cl.id, cl.primary_agent_id);
    }
    setItems(
      escRows
        .map((esc) => ({
          esc,
          customerName: custByClaim.get(esc.id) ?? 'Unknown',
          agentId: agentByClaim.get(esc.id) ?? null,
        }))
        .sort(
          (a, b) =>
            PRIO_ORDER[a.esc.priority] - PRIO_ORDER[b.esc.priority] ||
            b.esc.wait_minutes - a.esc.wait_minutes,
        ),
    );
  };

  useEffect(() => {
    void load();
    const off = subscribeToTable('escalations', () => void load(), '*');
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCase = (id: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('case', id);
    router.replace(`/live?${next.toString()}`);
  };

  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Human escalations
          <span className="count mono">{items.length} WAITING</span>
        </div>
        <div className="panel__hdr-actions">
          <button className="icon-btn" title="Filter" aria-label="Filter">⇅</button>
        </div>
      </div>
      <div className="panel__body">
        <div className="escq">
          {items.map(({ esc, customerName, agentId }) => (
            <EscalationItem
              key={esc.id}
              esc={esc}
              customerName={customerName}
              agentId={agentId}
              onClaim={openCase}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
