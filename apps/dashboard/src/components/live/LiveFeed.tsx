'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FeedRow } from './FeedRow';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';
import type { Claim, Customer, Order } from '@/lib/supabase/types';

interface FeedItem {
  claim: Claim;
  customerName: string;
  productName: string | null;
}

const MAX_ITEMS = 40;
const NEW_FLAG_MS = 4_000;

/**
 * Bottom half of the center column. Streams INSERT events on `claims` and
 * prepends them. Joins customer/order metadata lazily so the initial
 * payload from Realtime (which is the raw claim row only) is enough to
 * render a placeholder, then we backfill names.
 */
export function LiveFeed() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const newTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Initial backfill — last 60 min of claims, joined to customer + order.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: claims } = await supabase
        .from('claims')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS);
      if (!claims || cancelled) return;

      const customerIds = Array.from(new Set((claims as Claim[]).map((c) => c.customer_id)));
      const orderIds = Array.from(
        new Set((claims as Claim[]).map((c) => c.order_id).filter((x): x is string => !!x)),
      );

      const [custRes, ordRes] = await Promise.all([
        customerIds.length
          ? supabase.from('customers').select('*').in('id', customerIds)
          : Promise.resolve({ data: [] as Customer[] }),
        orderIds.length
          ? supabase.from('orders').select('*').in('id', orderIds)
          : Promise.resolve({ data: [] as Order[] }),
      ]);

      const custMap = new Map<string, Customer>();
      for (const c of (custRes.data ?? []) as Customer[]) custMap.set(c.id, c);
      const ordMap = new Map<string, Order>();
      for (const o of (ordRes.data ?? []) as Order[]) ordMap.set(o.id, o);

      if (cancelled) return;
      setItems(
        (claims as Claim[]).map((claim) => ({
          claim,
          customerName: custMap.get(claim.customer_id)?.name ?? 'Unknown',
          productName: claim.order_id ? ordMap.get(claim.order_id)?.product_name ?? null : null,
        })),
      );
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime: handle INSERT (new claim) and UPDATE (pipeline progress, reused
  // claim gets a new email). On UPDATE we refresh the row in place — or prepend
  // it if it isn't already in the feed (covers claims reused across sessions).
  useEffect(() => {
    const flagNew = (id: string) => {
      setNewIds((prev) => new Set(prev).add(id));
      const prevTimer = newTimers.current.get(id);
      if (prevTimer) clearTimeout(prevTimer);
      const timer = setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        newTimers.current.delete(id);
      }, NEW_FLAG_MS);
      newTimers.current.set(id, timer);
    };

    const off = subscribeToTable<Claim>(
      'claims',
      (payload) => {
        if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
        const claim = (payload.new ?? null) as Claim | null;
        if (!claim) return;

        const isInsert = payload.eventType === 'INSERT';

        setItems((prev) => {
          const existing = prev.find((p) => p.claim.id === claim.id);
          if (existing) {
            // UPDATE: refresh claim data in place, keep joined names.
            return prev.map((p) =>
              p.claim.id === claim.id ? { ...p, claim } : p,
            );
          }
          // INSERT or UPDATE for a claim not yet in the feed: prepend it.
          return [
            { claim, customerName: '…', productName: null },
            ...prev,
          ].slice(0, MAX_ITEMS);
        });

        // Highlight on INSERT, or on UPDATE when the email pipeline kicks in
        // (stage moves from 'intake' → anything else signals activity).
        if (isInsert || payload.eventType === 'UPDATE') {
          flagNew(claim.id);
        }

        // Backfill customer / order names if we don't have them yet.
        void (async () => {
          const [custRes, ordRes] = await Promise.all([
            supabase.from('customers').select('name').eq('id', claim.customer_id).maybeSingle(),
            claim.order_id
              ? supabase.from('orders').select('product_name').eq('id', claim.order_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const customerName = ((custRes.data as { name: string } | null)?.name) ?? 'Unknown';
          const productName = ((ordRes.data as { product_name: string } | null)?.product_name) ?? null;
          setItems((prev) =>
            prev.map((p) =>
              p.claim.id === claim.id ? { ...p, customerName, productName } : p,
            ),
          );
        })();
      },
      '*',
    );
    const timers = newTimers.current;
    return () => {
      off();
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [supabase]);

  const counts = useMemo(
    () => ({
      voice: items.filter((i) => i.claim.channel === 'voice').length,
      email: items.filter((i) => i.claim.channel === 'email').length,
      web:   items.filter((i) => i.claim.channel === 'web').length,
    }),
    [items],
  );

  const openCase = (id: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('case', id);
    router.replace(`/live?${next.toString()}`);
  };

  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Inbound activity
          <span className="count mono">LAST 24H</span>
        </div>
        <div className="panel__hdr-actions">
          <span className="chip">VOICE · {counts.voice}</span>
          <span className="chip">EMAIL · {counts.email}</span>
          <span className="chip">WEB · {counts.web}</span>
        </div>
      </div>
      <div className="panel__body">
        <div className="feed__hdr-row">
          <div>TIME</div>
          <div>CHANNEL</div>
          <div>CUSTOMER · PRODUCT</div>
          <div>CASE ID</div>
          <div>WITH AGENT</div>
          <div>DECISION</div>
        </div>
        <div className="feed">
          {items.map(({ claim, customerName, productName }) => (
            <FeedRow
              key={claim.id}
              id={claim.id}
              channel={claim.channel}
              customerName={customerName}
              productName={productName}
              createdAt={claim.created_at}
              decision={claim.decision}
              stage={claim.stage}
              statusDetail={claim.status_detail}
              displayStatus={claim.display_status}
              isNew={newIds.has(claim.id)}
              onOpen={openCase}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
