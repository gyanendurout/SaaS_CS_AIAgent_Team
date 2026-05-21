'use client';

import { useEffect, useState } from 'react';
import { Waveform } from './Waveform';
import { SentimentBar } from './SentimentBar';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeToTable } from '@/lib/supabase/realtime';
import { pad } from '@/lib/format';
import type { Claim, Transcript } from '@/lib/supabase/types';

interface CallCardProps {
  claim: Claim;
  customerName: string;
  customerEmail: string;
  customerCountry: string;
  customerPhone?: string | null;
  onOpen?: (claimId: string) => void;
}

const DECISION_LABEL: Record<string, string> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: 'ELIGIBLE',
  NOT_ELIGIBLE: 'NOT ELIGIBLE',
  HUMAN_REVIEW_REQUIRED: 'HUMAN REVIEW',
  WARRANTY_EXPIRED: 'EXPIRED',
  PROCESSING: 'PROCESSING',
};

/**
 * One card per active voice call. Subscribes to transcripts for this claim
 * and shows the last 4 lines, with the most recent fully opaque and older
 * lines faded. Cards are only rendered for claims with channel='voice'
 * AND display_status='OPEN' (see ActiveCalls).
 */
export function CallCard({
  claim,
  customerName,
  customerEmail,
  customerCountry,
  customerPhone,
  onOpen,
}: CallCardProps) {
  const supabase = useSupabase();
  const [lines, setLines] = useState<Transcript[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // Initial transcript load — most recent 10 lines, oldest first.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('transcripts')
        .select('*')
        .eq('claim_id', claim.id)
        .order('line_index', { ascending: true })
        .limit(40);
      if (!cancelled && data) setLines(data as Transcript[]);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [claim.id, supabase]);

  // Realtime: append new transcript lines for THIS claim.
  useEffect(() => {
    const off = subscribeToTable<Transcript>(
      'transcripts',
      (payload) => {
        if (payload.eventType !== 'INSERT') return;
        const row = (payload.new ?? null) as Transcript | null;
        if (!row) return;
        setLines((prev) => {
          if (prev.some((p) => p.id === row.id)) return prev;
          return [...prev, row].sort((a, b) => a.line_index - b.line_index);
        });
      },
      'INSERT',
      `claim_id=eq.${claim.id}`,
    );
    return off;
  }, [claim.id]);

  // Tick a wall-clock so the elapsed timer ticks once per second.
  useEffect(() => {
    const startedAt = new Date(claim.created_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [claim.created_at]);

  const visible = lines.slice(-4);
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const decisionLabel = DECISION_LABEL[claim.decision] ?? claim.decision;

  return (
    <div className="call">
      <div className="call__head">
        <div>
          <div className="call__id mono">
            {claim.id} · {claim.channel.toUpperCase()}
          </div>
          <div className="call__customer">{customerName}</div>
          <div className="call__sub">
            <span className="mono">{customerEmail}</span> · {customerCountry}
            {customerPhone && (
              <>
                {' '}
                · <span className="mono">{customerPhone}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`call__channel call__channel--${claim.channel}`}>
            {claim.channel === 'voice' && '◉'}
            {claim.channel === 'email' && '✉'}
            {claim.channel === 'web' && '▤'} {claim.channel.toUpperCase()}
          </span>
          <Waveform active={claim.channel === 'voice'} />
        </div>
      </div>

      <div className="call__transcript">
        {visible.map((line, i) => (
          <div
            key={line.id}
            className={`tline ${line.who === 'CUSTOMER' ? 'who-cust' : 'who-ai'} ${
              i < visible.length - 1 ? 'is-fading' : ''
            }`}
          >
            <span className="who">{line.who === 'CUSTOMER' ? 'CUST' : 'AI ▸'}</span>
            <span className="txt">{line.txt}</span>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="tline who-cust" style={{ opacity: 0.4 }}>
            <span className="who" style={{ color: 'var(--ops-fg-4)' }}>···</span>
            <span className="txt" style={{ color: 'var(--ops-fg-4)' }}>listening…</span>
          </div>
        )}
      </div>

      <div className="call__footer">
        <span className="stage">
          STAGE · <b>{claim.stage.toUpperCase()}</b>
        </span>
        <SentimentBar value={claim.sentiment ?? null} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip">{decisionLabel}</span>
          <span className="mono">{mm}:{pad(ss)}</span>
          <button
            onClick={() => onOpen?.(claim.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--ops-fg)',
              padding: '2px 6px',
              border: '1px solid var(--ops-line)',
            }}
            title="Open case"
          >
            OPEN ⤤
          </button>
        </span>
      </div>
    </div>
  );
}
