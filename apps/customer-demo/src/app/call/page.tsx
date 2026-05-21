'use client';

/**
 * Voice channel — Vapi Web SDK integration.
 *
 * The Vapi SDK runs entirely client-side over WebRTC. We:
 *   1. Lazy-load the SDK on mount (keeps it out of other route bundles).
 *   2. Wire the standard event set (call-start, speech-start/end, message,
 *      error, call-end) to React state.
 *   3. Start a call with the assistant ID + variableValues so the system
 *      prompt knows who the customer is.
 *   4. Render: status pill, animated waveform, big start/stop button, and
 *      a live transcript that accumulates partial -> final message events.
 *
 * Microphone permission is requested by Vapi the first time `start()` is
 * called; if the user denies it, we surface a friendly error banner.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChannelNav } from '@/components/ChannelNav';
import { ScenarioHints } from '@/components/ScenarioHints';
import { Card, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { LiveTranscript } from '@/components/voice/LiveTranscript';
import { LiveWaveform } from '@/components/voice/LiveWaveform';
import { VoiceCallButton } from '@/components/voice/VoiceCallButton';
import { VoiceErrorBanner } from '@/components/voice/VoiceErrorBanner';
import { VoiceStatus } from '@/components/voice/VoiceStatus';
import {
  buildAssistantOverrides,
  getVapiAssistantId,
  loadVapiClient,
} from '@/lib/vapi/client';
import type { TranscriptLine, TranscriptRole, VoiceStatus as Status } from '@/lib/vapi/types';
import { useSupabase } from '@/providers/SupabaseProvider';

/** Minimal interface we narrow the loaded Vapi instance to. */
type VapiInstance = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener?: (...args: unknown[]) => void) => void;
  removeAllListeners?: () => void;
  start: (assistantId: string, overrides?: Record<string, unknown>) => Promise<unknown> | unknown;
  stop: () => void | Promise<void>;
};

type VapiTranscriptMessage = {
  type: 'transcript';
  role?: TranscriptRole | 'system';
  transcript?: string;
  transcriptType?: 'partial' | 'final';
};

function makeLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CallPage() {
  const { current, loading } = useSupabase();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const vapiRef = useRef<VapiInstance | null>(null);

  // Lazy-load the SDK on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = (await loadVapiClient()) as VapiInstance;
        if (cancelled) return;
        vapiRef.current = v;

        v.on('call-start', () => {
          setStatus('listening');
          setError(null);
        });
        v.on('speech-start', () => setStatus('speaking'));
        v.on('speech-end', () => setStatus('listening'));
        v.on('message', (...args: unknown[]) => {
          const msg = args[0] as VapiTranscriptMessage | undefined;
          if (!msg || msg.type !== 'transcript') return;
          const role: TranscriptRole = msg.role === 'assistant' ? 'assistant' : 'user';
          const text = msg.transcript ?? '';
          const final = msg.transcriptType === 'final';
          setLines((cur) => {
            // Merge consecutive partials from the same speaker into one bubble
            const last = cur[cur.length - 1];
            if (last && !last.final && last.role === role) {
              const next = cur.slice(0, -1);
              next.push({ ...last, text, final, at: Date.now() });
              return next;
            }
            return [...cur, { id: makeLineId(), role, text, final, at: Date.now() }];
          });
        });
        v.on('error', (...args: unknown[]) => {
          const e = args[0];
          const message =
            e instanceof Error
              ? e.message
              : typeof e === 'string'
                ? e
                : 'Voice service hit an unexpected error.';
          setError(message);
          setStatus('error');
        });
        v.on('call-end', () => setStatus('ended'));

        setSdkReady(true);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to load the voice SDK in your browser.';
        setError(message);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      try {
        vapiRef.current?.removeAllListeners?.();
        // ensure call is stopped if user leaves the page mid-call
        vapiRef.current?.stop?.();
      } catch {
        // ignore — SDK might already be torn down
      }
    };
  }, []);

  const onStart = useCallback(async () => {
    if (!current) return;
    if (!vapiRef.current) {
      setError('Voice SDK is still loading. Try again in a moment.');
      return;
    }
    setError(null);
    setLines([]);
    setStatus('connecting');
    try {
      // Pre-create an empty voice claim so the webhook can persist transcripts
      // against it and the dashboard sees the live call immediately.
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      let claimId: string | undefined;
      try {
        const resp = await fetch(`${apiBase}/api/customer/voice/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ customer_id: current.id }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as { claim_id?: string };
          claimId = data.claim_id;
        } else {
          // Non-fatal — call still works, just no dashboard visibility.
          console.warn('voice/start returned', resp.status, await resp.text());
        }
      } catch (err) {
        console.warn('voice/start failed (continuing without dashboard link):', err);
      }

      const assistantId = getVapiAssistantId();
      await vapiRef.current.start(
        assistantId,
        buildAssistantOverrides(
          {
            customer_id: current.id,
            customer_name: current.name,
            customer_email: current.email,
          },
          claimId,
        ),
      );
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Could not start the call. Check your microphone permission and try again.';
      setError(message);
      setStatus('error');
    }
  }, [current]);

  const onEnd = useCallback(() => {
    try {
      vapiRef.current?.stop();
    } catch {
      // ignore — stop is idempotent enough
    }
    setStatus('ended');
  }, []);

  const startDisabled = useMemo(() => {
    return loading || !current || !sdkReady;
  }, [loading, current, sdkReady]);

  return (
    <>
      <ChannelNav />
      <main className="mx-auto max-w-6xl px-6 pt-8">
        <header className="mb-6">
          <p className="m-0 font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
            Voice channel
          </p>
          <h1 className="m-0 mt-1 font-display text-2xl uppercase tracking-tight text-joola-black">
            Talk to JOOLA support
          </h1>
          <p className="m-0 mt-2 max-w-2xl text-sm text-joola-graphite">
            Hit start when you're ready. Our AI assistant picks up, asks how it can help, and can
            look up your order, check NFC registration, and open a warranty case in real time.
          </p>
        </header>

        {error && (
          <div className="mb-4">
            <VoiceErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={status !== 'connecting' ? onStart : undefined}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Card pad="lg" accent>
            <CardHeader>
              <div>
                <CardEyebrow>Live call</CardEyebrow>
                <CardTitle>Voice control</CardTitle>
              </div>
              <VoiceStatus status={status} />
            </CardHeader>

            <div className="my-4">
              <LiveWaveform status={status} />
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <VoiceCallButton
                status={status}
                onStart={onStart}
                onEnd={onEnd}
                disabled={startDisabled}
              />
              {!sdkReady && !error && (
                <p className="m-0 font-mono text-[11px] uppercase tracking-mega text-joola-stone">
                  Loading voice SDK…
                </p>
              )}
              {current && sdkReady && status === 'idle' && (
                <p className="m-0 max-w-xs text-center text-xs text-joola-stone">
                  Calling as <strong className="text-joola-ink">{current.name}</strong> ·{' '}
                  <span className="font-mono">{current.email}</span>
                </p>
              )}
            </div>
          </Card>

          <Card pad="lg">
            <CardHeader>
              <div>
                <CardEyebrow>Transcript</CardEyebrow>
                <CardTitle>Conversation</CardTitle>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-mega text-joola-stone">
                {lines.length} line{lines.length === 1 ? '' : 's'}
              </span>
            </CardHeader>
            <LiveTranscript lines={lines} />
          </Card>
        </div>
      </main>
      <ScenarioHints channel="voice" />
    </>
  );
}
