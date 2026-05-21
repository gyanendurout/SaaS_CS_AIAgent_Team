'use client';

import { useCallback, useState } from 'react';
import { cx } from '@/lib/format';

type Scenario = {
  label: string;
  text: string;
  /** Short tag of which policy section / decision this exercises. */
  outcome: string;
  /** Optional tone hint to color the chip. */
  tone?: 'good' | 'decline' | 'escalate' | 'expired';
  /** Optional seeded persona the user should switch to before sending. */
  beCustomer?: string;
};

type Props = {
  /** Which channel this is rendered on — drives which scenarios appear. */
  channel: 'voice' | 'email' | 'web';
};

const SCENARIOS_VOICE: Scenario[] = [
  {
    label: 'NFC paddle registered',
    text: "Hi, my paddle is cracked. I bought it from joola.com three months ago and I registered it on the Infinity app the same day.",
    outcome: 'ELIGIBLE — 12mo NFC warranty',
    tone: 'good',
  },
  {
    label: 'eBay purchase',
    text: "I bought my JOOLA paddle on eBay and the grip is coming off. Can I get a replacement?",
    outcome: 'NOT_ELIGIBLE — §1.7 unauthorized seller',
    tone: 'decline',
  },
  {
    label: 'Late NFC registration',
    text: "It's been three weeks since I bought my NFC paddle from joola.com and I just realized I never registered it. Can I still get the 12 month warranty?",
    outcome: 'Standard 6mo only — §4.5',
    tone: 'expired',
  },
  {
    label: 'Damaged table, refused delivery',
    text: "My table arrived crushed on one corner. I refused the delivery and the driver took it back.",
    outcome: 'ELIGIBLE — §2.7',
    tone: 'good',
  },
  {
    label: 'Damaged table, signed for it',
    text: "My outdoor table arrived damaged but I signed for it before I noticed. What can you do?",
    outcome: 'HUMAN_REVIEW — §2.7',
    tone: 'escalate',
  },
];

const SCENARIOS_EMAIL: Scenario[] = [
  {
    label: '1. ELIGIBLE · NFC registered',
    beCustomer: 'Daniel Kim',
    text:
      "Subject: Paddle face delamination — order JD-100014\n\nHi JOOLA team,\n\nMy Magnus 3 14mm (order JD-100014) started delaminating at the top edge after about three weeks of play. There's a clear bubble where the carbon face has separated from the core. I registered it via NFC the day it arrived.\n\nCould you start a warranty replacement?\n\nThanks,\nDaniel Kim",
    outcome: 'ELIGIBLE — clean approval',
    tone: 'good',
  },
  {
    label: '2. NOT ELIGIBLE · eBay seller',
    beCustomer: 'Marcus Hall',
    text:
      "Subject: Warranty claim for cracked paddle EB-300002\n\nHello,\n\nMy JOOLA Perseus 3 14mm cracked along the handle. I bought it on eBay (order EB-300002) earlier this year. Looking to claim warranty replacement under the 1-year coverage.\n\nRegards,\nMarcus",
    outcome: 'NOT_ELIGIBLE — §3.2 unauthorized seller',
    tone: 'decline',
  },
  {
    label: '3. NOT ELIGIBLE · late NFC reg',
    beCustomer: 'Emily White',
    text:
      "Subject: Perseus 3 carbon face peeling — JD-100005\n\nHi,\n\nThe carbon face on my Perseus 3 16mm (order JD-100005, purchased December) is peeling near the throat. I did register it on the NFC chip, but a bit later — I think a month after it arrived.\n\nCan I still get this replaced?\n\nEmily",
    outcome: 'NOT_ELIGIBLE — §2.5 outside 14d',
    tone: 'expired',
  },
  {
    label: '4. NOT ELIGIBLE · never registered',
    beCustomer: 'Aisha Khan',
    text:
      "Subject: Solaire paddle broken\n\nHey,\n\nMy Solaire paddle (JD-100017) snapped at the handle today. I bought it directly from JOOLA in March. I didn't register the NFC chip — wasn't sure what to do with it. Hoping for a replacement.\n\nAisha",
    outcome: 'NOT_ELIGIBLE — no NFC reg',
    tone: 'decline',
  },
  {
    label: '5. ESCALATE · FB Marketplace',
    beCustomer: 'Nadia Costa',
    text:
      "Subject: Magnus 3 from FB Marketplace stopped responding\n\nHi support,\n\nI picked up a Magnus 3 16mm second-hand off Facebook Marketplace last November (order ref FB-400001). The dead-spot in the sweet spot is huge now. The seller claimed it was authentic. Can JOOLA verify and replace if it's genuine?\n\nThanks,\nNadia",
    outcome: 'ESCALATE — DISPUTED_SELLER',
    tone: 'escalate',
  },
  {
    label: '6. ESCALATE · SAFETY / injury',
    beCustomer: 'Jamal Wright',
    text:
      "Subject: Paddle shattered mid-game — cut my hand\n\nHello,\n\nDuring a doubles match this morning my Perseus 3 16mm (JD-100057) split in half on a normal forehand. A shard cut my hand and I had to go to urgent care for three stitches. I'd like to flag this as a safety issue and discuss a replacement.\n\nJamal Wright",
    outcome: 'ESCALATE — SAFETY',
    tone: 'escalate',
  },
  {
    label: '7. ESCALATE · international',
    beCustomer: 'Ravi Kumar',
    text:
      "Subject: Warranty claim from India — JD-100040\n\nHello JOOLA team,\n\nI'm writing from Bangalore, India. My Perseus 3 16mm (JD-100040) developed a soft spot near the sweet spot after about six weeks. NFC was registered on arrival. I understand JOOLA primarily ships from US — what's the process for an international warranty replacement?\n\nBest,\nRavi Kumar",
    outcome: 'ESCALATE — OUTSIDE_REGION',
    tone: 'escalate',
  },
  {
    label: '8. GENERIC inquiry · route to human',
    beCustomer: 'Sarah Lee',
    text:
      "Subject: What's the typical shipping time?\n\nHi there,\n\nQuick question — if I order a paddle today, roughly how long does shipping take to California? And do you ship in plain packaging?\n\nThanks,\nSarah",
    outcome: 'HUMAN — no warranty signal',
    tone: 'escalate',
  },
  {
    label: '9. Resolved by NAME (no order #)',
    beCustomer: 'Hannah Bauer',
    text:
      "Subject: New email but I have a question about my JOOLA paddle\n\nHi,\n\nI switched email accounts but I bought a Vision CGS 16mm from JOOLA a couple months ago and it's already showing wear on the edge. I'd like to know if I'm eligible for any warranty help.\n\nRegards,\nHannah Bauer",
    outcome: 'Resolved via signature name',
    tone: 'good',
  },
  {
    label: '10. AWAIT REPLY · missing order info',
    beCustomer: 'Priya Nair',
    text:
      "Subject: Paddle issue but not sure about order number\n\nHi,\n\nI got a JOOLA paddle as a gift last month and the face is starting to peel. I don't have the original order number — my partner bought it. Is there any way to still file a warranty claim?\n\nThanks,\nPriya",
    outcome: 'AWAITING_CUSTOMER_REPLY — CS requests order #',
    tone: 'escalate',
  },
];

const SCENARIOS_WEB: Scenario[] = [
  {
    label: 'Standard paddle defect',
    text:
      'Bought a standard paddle from joola.com 2 months ago. The edge guard is peeling off after normal use. Have photos.',
    outcome: 'ELIGIBLE — standard 6mo',
    tone: 'good',
  },
  {
    label: 'Outside warranty window',
    text: 'My pickleball bag started fraying along the zipper. I bought it 9 months ago from joola.com.',
    outcome: 'WARRANTY_EXPIRED — bag = 6mo',
    tone: 'expired',
  },
  {
    label: 'Signed-for table damage',
    text:
      "Indoor table arrived with a deep scratch on the top, but I signed for it not realizing how bad it was. Photos attached.",
    outcome: 'HUMAN_REVIEW — §2.7',
    tone: 'escalate',
  },
];

function pickScenarios(channel: Props['channel']): Scenario[] {
  switch (channel) {
    case 'voice':
      return SCENARIOS_VOICE;
    case 'email':
      return SCENARIOS_EMAIL;
    case 'web':
      return SCENARIOS_WEB;
  }
}

/**
 * Collapsible "demo helper" panel. Each scenario card has a one-line label,
 * the multi-line text the CS Lead can copy verbatim, and a colored chip
 * showing the expected policy outcome so they know what to expect on screen.
 *
 * Clicking the card copies the text to clipboard — it does NOT auto-fill,
 * to avoid making the demo feel scripted.
 */
export function ScenarioHints({ channel }: Props) {
  const [open, setOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scenarios = pickScenarios(channel);

  const onCopy = useCallback(async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      // ignore clipboard failures — non-critical
    }
  }, []);

  return (
    <section className="mx-auto mt-8 max-w-6xl px-6 pb-8">
      <div className="overflow-hidden rounded border border-joola-fog bg-joola-paper">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 border-b border-joola-fog bg-white px-5 py-3 text-left hover:bg-joola-paper"
          aria-expanded={open}
        >
          <span className="flex items-center gap-3">
            <span className="rounded-pill bg-joola-yellow px-2 py-0.5 font-mono text-[10px] uppercase tracking-mega text-joola-black">
              Demo helper
            </span>
            <span className="font-sans text-sm font-bold uppercase tracking-tight text-joola-black">
              Try these scenarios
            </span>
            <span className="hidden text-xs text-joola-stone sm:inline">
              Click any card to copy it to your clipboard
            </span>
          </span>
          <span aria-hidden className="font-mono text-xs text-joola-stone">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {open && (
          <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => onCopy(i, s.text)}
                  className="group flex h-full w-full flex-col items-start gap-2 rounded-sm border border-joola-fog bg-white p-3 text-left transition-colors hover:border-joola-black"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-sans text-xs font-bold uppercase tracking-tight text-joola-black">
                      {s.label}
                    </span>
                    <span
                      className={cx(
                        'rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
                        s.tone === 'good' && 'bg-emerald-50 text-emerald-700',
                        s.tone === 'decline' && 'bg-rose-50 text-rose-700',
                        s.tone === 'escalate' && 'bg-amber-50 text-amber-700',
                        s.tone === 'expired' && 'bg-slate-100 text-slate-700',
                        !s.tone && 'bg-joola-fog text-joola-graphite',
                      )}
                    >
                      {s.outcome}
                    </span>
                  </span>
                  {s.beCustomer && (
                    <span className="font-mono text-[10px] uppercase tracking-mega text-joola-stone">
                      Switch to: <span className="text-joola-black">{s.beCustomer}</span>
                    </span>
                  )}
                  <span className="line-clamp-3 whitespace-pre-line text-xs text-joola-graphite">
                    {s.text}
                  </span>
                  <span
                    aria-hidden
                    className={cx(
                      'mt-auto font-mono text-[10px] uppercase tracking-mega',
                      copiedIdx === i ? 'text-joola-court-green' : 'text-joola-stone group-hover:text-joola-graphite',
                    )}
                  >
                    {copiedIdx === i ? 'Copied!' : 'Tap to copy'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
