'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CallCard } from './CallCard';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';
import type { Claim, Customer } from '@/lib/supabase/types';

interface JoinedCall {
  claim: Claim;
  customer: Customer;
}

/**
 * Top half of the center column. Shows up to ~4 active voice calls.
 * Pulls claims where channel='voice' AND display_status='OPEN', then joins
 * to customers in a second query (PostgREST nested selects are noisier
 * to type — separate queries are cleaner here).
 */
export function ActiveCalls() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [calls, setCalls] = useState<JoinedCall[]>([]);

  const load = async () => {
    const { data: claims } = await supabase
      .from('claims')
      .select('*')
      .eq('channel', 'voice')
      .eq('display_status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(4);
    if (!claims || claims.length === 0) {
      setCalls([]);
      return;
    }
    const customerIds = Array.from(new Set((claims as Claim[]).map((c) => c.customer_id)));
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .in('id', customerIds);
    const byId = new Map<string, Customer>();
    for (const c of (customers ?? []) as Customer[]) byId.set(c.id, c);
    setCalls(
      (claims as Claim[])
        .map((claim) => {
          const customer = byId.get(claim.customer_id);
          if (!customer) return null;
          return { claim, customer };
        })
        .filter((x): x is JoinedCall => x !== null),
    );
  };

  // Initial load + refetch on any claim INSERT/UPDATE
  useEffect(() => {
    void load();
    const off = subscribeToTable('claims', () => void load(), '*');
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openClaim = (claimId: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('case', claimId);
    router.replace(`/live?${next.toString()}`);
  };

  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Active conversations
          <span className="count mono">{calls.length} LIVE</span>
        </div>
        <div className="panel__hdr-actions">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ops-fg-3)',
              letterSpacing: '.1em',
            }}
          >
            CHANNEL · ALL ▾
          </span>
        </div>
      </div>
      <div className="panel__body">
        {calls.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 10,
              opacity: 0.45,
            }}
          >
            <span style={{ fontSize: 28 }}>◉</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--ops-fg)',
              }}
            >
              No active voice calls
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '.08em',
                color: 'var(--ops-fg)',
                opacity: 0.6,
              }}
            >
              Cards appear here when a call is in progress
            </span>
          </div>
        ) : (
          <div className="calls">
            {calls.map(({ claim, customer }) => (
              <CallCard
                key={claim.id}
                claim={claim}
                customerName={customer.name}
                customerEmail={customer.email}
                customerCountry={customer.country}
                customerPhone={customer.phone}
                onOpen={openClaim}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
