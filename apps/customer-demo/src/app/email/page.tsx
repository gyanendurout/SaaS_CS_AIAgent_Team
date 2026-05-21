'use client';

import { ChannelNav } from '@/components/ChannelNav';
import { ScenarioHints } from '@/components/ScenarioHints';
import { Card, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmailCompose } from '@/components/email/EmailCompose';
import { EmailInbox } from '@/components/email/EmailInbox';
import { useSupabase } from '@/providers/SupabaseProvider';

export default function EmailPage() {
  const { current, loading } = useSupabase();

  return (
    <>
      <ChannelNav />
      <main className="mx-auto max-w-6xl px-6 pt-8">
        <header className="mb-6">
          <p className="m-0 font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
            Email channel
          </p>
          <h1 className="m-0 mt-1 font-display text-2xl uppercase tracking-tight text-joola-black">
            Email JOOLA support
          </h1>
          <p className="m-0 mt-2 max-w-2xl text-sm text-joola-graphite">
            Send a message to <span className="font-mono">support@joola.com</span>. JOOLA AI will
            read it, reply, and the conversation appears in the inbox on the left in real time.
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
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card pad="md">
              <CardHeader>
                <div>
                  <CardEyebrow>Inbox</CardEyebrow>
                  <CardTitle>{current.name}</CardTitle>
                </div>
                <span className="font-mono text-[11px] text-joola-stone">{current.email}</span>
              </CardHeader>
              <EmailInbox />
            </Card>

            <Card pad="md">
              <CardHeader>
                <div>
                  <CardEyebrow>New message</CardEyebrow>
                  <CardTitle>Compose</CardTitle>
                </div>
              </CardHeader>
              <EmailCompose />
            </Card>
          </div>
        )}
      </main>
      <ScenarioHints channel="email" />
    </>
  );
}
