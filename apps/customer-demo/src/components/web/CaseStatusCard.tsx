'use client';

import { useEffect, useState } from 'react';

import { Card, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { useSupabase } from '@/providers/SupabaseProvider';
import { subscribeClaimUpdates, type ClaimRow, type EmailRow } from '@/lib/supabase/realtime';
import { cx, timeAgo } from '@/lib/format';
import { FollowUpInput } from './FollowUpInput';

type Props = {
  claimId: string;
};

const DECISION_LABEL: Record<string, { label: string; tone: string }> = {
  PROCESSING: { label: 'Processing', tone: 'bg-joola-fog text-joola-graphite' },
  ELIGIBLE_FOR_DAMAGE_REVIEW: { label: 'Eligible — damage review', tone: 'bg-emerald-50 text-emerald-700' },
  NOT_ELIGIBLE: { label: 'Not eligible', tone: 'bg-rose-50 text-rose-700' },
  HUMAN_REVIEW_REQUIRED: { label: 'Human review', tone: 'bg-amber-50 text-amber-700' },
  WARRANTY_EXPIRED: { label: 'Warranty expired', tone: 'bg-slate-100 text-slate-700' },
};

/**
 * Live status card for the just-opened web case. Subscribes to UPDATEs on
 * the single claim row and also pulls in any outbound `emails` row tied to
 * this claim (so the AI's drafted reply appears as soon as it's sent).
 */
export function CaseStatusCard({ claimId }: Props) {
  const { client } = useSupabase();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [latestReply, setLatestReply] = useState<EmailRow | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(true);

  // Initial claim fetch
  useEffect(() => {
    let cancelled = false;
    setLoadingClaim(true);
    (async () => {
      const { data } = await client.from('claims').select('*').eq('id', claimId).maybeSingle();
      if (cancelled) return;
      setClaim((data as ClaimRow | null) ?? null);
      setLoadingClaim(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, claimId]);

  // Initial reply fetch + Realtime
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await client
        .from('emails')
        .select('*')
        .eq('claim_id', claimId)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const first = data?.[0];
      if (first) setLatestReply(first as EmailRow);
    })();

    const ch = client
      .channel(`case-reply-${claimId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emails',
          filter: `claim_id=eq.${claimId}`,
        },
        (payload) => {
          const row = payload.new as EmailRow;
          if (row.direction === 'outbound') setLatestReply(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(ch);
    };
  }, [client, claimId]);

  // Claim Realtime
  useEffect(() => {
    const ch = subscribeClaimUpdates(client, claimId, (row) => setClaim(row));
    return () => {
      void client.removeChannel(ch);
    };
  }, [client, claimId]);

  const decision = claim?.decision ?? 'PROCESSING';
  const meta = DECISION_LABEL[decision] ?? DECISION_LABEL.PROCESSING;
  const isOpen = claim ? claim.display_status !== 'CLOSED' : true;

  return (
    <Card accent pad="md">
      <CardHeader>
        <div>
          <CardEyebrow>Case</CardEyebrow>
          <CardTitle>{claimId}</CardTitle>
        </div>
        <span
          className={cx(
            'rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-mega',
            meta?.tone ?? 'bg-joola-fog text-joola-graphite',
          )}
        >
          {meta?.label ?? decision}
        </span>
      </CardHeader>

      {loadingClaim ? (
        <p className="m-0 text-sm text-joola-stone">Loading case…</p>
      ) : !claim ? (
        <p className="m-0 text-sm text-joola-stone">
          Case is being created… this card will update as soon as it lands.
        </p>
      ) : (
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="font-bold uppercase tracking-mega text-joola-stone">Stage</dt>
          <dd className="m-0 font-mono text-joola-ink">{claim.stage}</dd>
          <dt className="font-bold uppercase tracking-mega text-joola-stone">Status</dt>
          <dd className="m-0 font-mono text-joola-ink">{claim.status_detail}</dd>
          {claim.citation && (
            <>
              <dt className="font-bold uppercase tracking-mega text-joola-stone">Policy</dt>
              <dd className="m-0 font-mono text-joola-ink">{claim.citation}</dd>
            </>
          )}
          <dt className="font-bold uppercase tracking-mega text-joola-stone">Opened</dt>
          <dd className="m-0 font-mono text-joola-ink">{timeAgo(claim.created_at)}</dd>
        </dl>
      )}

      <div className="mt-4 border-t border-joola-fog pt-4">
        <CardEyebrow>Latest reply from JOOLA</CardEyebrow>
        {latestReply ? (
          <div className="mt-2 rounded-sm border border-joola-yellow/60 border-l-4 border-l-joola-yellow bg-white p-3">
            <p className="m-0 mb-1 font-sans text-sm font-bold text-joola-black">
              {latestReply.subject}
            </p>
            <p className="m-0 whitespace-pre-wrap font-sans text-sm text-joola-ink">
              {latestReply.body}
            </p>
            <p className="m-0 mt-2 font-mono text-[10px] uppercase tracking-mega text-joola-stone">
              {timeAgo(latestReply.created_at)}
            </p>
          </div>
        ) : (
          <p className="m-0 mt-2 text-sm text-joola-stone">
            No reply yet — JOOLA AI is reviewing your case.
          </p>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-joola-fog pt-4">
          <CardEyebrow>Add follow-up</CardEyebrow>
          <div className="mt-2">
            <FollowUpInput claimId={claimId} />
          </div>
        </div>
      )}
    </Card>
  );
}
