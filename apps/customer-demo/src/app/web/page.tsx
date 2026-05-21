'use client';

import { useState } from 'react';

import { ChannelNav } from '@/components/ChannelNav';
import { ScenarioHints } from '@/components/ScenarioHints';
import { Card, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CaseStatusCard } from '@/components/web/CaseStatusCard';
import { WebFormSubmit } from '@/components/web/WebFormSubmit';
import { useSupabase } from '@/providers/SupabaseProvider';

/**
 * Web channel — submit a structured form, then watch the case status card
 * update live as the AI agents process it. The CS Lead can submit further
 * follow-ups inline, or click "Open another case" to reset.
 */
export default function WebPage() {
  const { current, loading } = useSupabase();
  const [openClaimIds, setOpenClaimIds] = useState<string[]>([]);

  return (
    <>
      <ChannelNav />
      <main className="mx-auto max-w-6xl px-6 pt-8">
        <header className="mb-6">
          <p className="m-0 font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
            Web form channel
          </p>
          <h1 className="m-0 mt-1 font-display text-2xl uppercase tracking-tight text-joola-black">
            Open a customer service case
          </h1>
          <p className="m-0 mt-2 max-w-2xl text-sm text-joola-graphite">
            Fill out the form — JOOLA AI opens a case immediately and starts working on it. The
            status card on the right updates in real time as the decision lands.
          </p>
        </header>

        {loading && (
          <div className="grid min-h-[180px] place-items-center rounded-sm border border-joola-fog bg-white">
            <span className="font-mono text-xs uppercase tracking-mega text-joola-stone">
              Loading customer identity…
            </span>
          </div>
        )}

        {!loading && current && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Card pad="md">
              <CardHeader>
                <div>
                  <CardEyebrow>New case</CardEyebrow>
                  <CardTitle>Tell us what's wrong</CardTitle>
                </div>
                <span className="font-mono text-[11px] text-joola-stone">{current.email}</span>
              </CardHeader>
              <WebFormSubmit
                onSubmitted={(claimId) =>
                  setOpenClaimIds((cur) => (cur.includes(claimId) ? cur : [claimId, ...cur]))
                }
              />
            </Card>

            <div className="flex flex-col gap-4">
              {openClaimIds.length === 0 && (
                <Card pad="md">
                  <CardHeader>
                    <div>
                      <CardEyebrow>Case status</CardEyebrow>
                      <CardTitle>Nothing open yet</CardTitle>
                    </div>
                  </CardHeader>
                  <p className="m-0 text-sm text-joola-graphite">
                    Submit the form on the left to open a case. The status card will appear here
                    and update live as JOOLA AI works through it.
                  </p>
                </Card>
              )}
              {openClaimIds.map((id) => (
                <CaseStatusCard key={id} claimId={id} />
              ))}
              {openClaimIds.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setOpenClaimIds([])}>
                    Clear cases from view
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <ScenarioHints channel="web" />
    </>
  );
}
