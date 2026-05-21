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
  /** Voice cards: order number to say aloud. */
  orderNumber?: string;
  /** Voice cards: email to provide. */
  email?: string;
};

type Props = {
  /** Which channel this is rendered on — drives which scenarios appear. */
  channel: 'voice' | 'email' | 'web';
};

const SCENARIOS_VOICE: Scenario[] = [
  {
    label: '1. ELIGIBLE · NFC registered',
    beCustomer: 'John Smith',
    orderNumber: 'JD-100001',
    text: "Hi, my Perseus 3 14mm is cracking along the edge. My order number is JD-100001 and I registered it on the Infinity app the day it arrived.",
    outcome: 'ELIGIBLE — 12mo NFC warranty',
    tone: 'good',
  },
  {
    label: '2. ELIGIBLE · email lookup only',
    beCustomer: 'Sarah Lee',
    email: 'sarah.lee@example.com',
    text: "Hi, I don't have my order number handy. My email is sarah.lee@example.com. My Hyperion CFS 16mm has a crack near the throat.",
    outcome: 'ELIGIBLE — lookup by email',
    tone: 'good',
  },
  {
    label: '3. ELIGIBLE · authorized retailer',
    beCustomer: 'Mike Brown',
    orderNumber: 'AR-200001',
    email: 'mike.brown@example.com',
    text: "My order number is AR-200001. I bought a Perseus 3 from an authorized retailer and the face is delaminating.",
    outcome: 'ELIGIBLE — authorized retailer',
    tone: 'good',
  },
  {
    label: '4. NOT ELIGIBLE · eBay purchase',
    beCustomer: 'Alex Green',
    orderNumber: 'EB-300001',
    email: 'alex.green@example.com',
    text: "I bought a Hyperion CFS 16mm on eBay, order EB-300001. The edge guard is coming off. Can I get a replacement?",
    outcome: 'NOT_ELIGIBLE — §1.7 unauthorized',
    tone: 'decline',
  },
  {
    label: '5. NOT ELIGIBLE · Facebook Marketplace',
    beCustomer: 'Nadia Costa',
    orderNumber: 'FB-400001',
    email: 'nadia.costa@example.com',
    text: "I picked up a Magnus 3 16mm off Facebook Marketplace, order FB-400001. It has a dead spot. Can I claim warranty?",
    outcome: 'NOT_ELIGIBLE — unauthorized seller',
    tone: 'decline',
  },
  {
    label: '6. NOT ELIGIBLE · late NFC registration',
    beCustomer: 'Emily White',
    orderNumber: 'JD-100005',
    email: 'emily.white@example.com',
    text: "My email is emily.white@example.com. I bought a Perseus 3 16mm in December, order JD-100005. I registered the NFC chip about a month after I got it. Am I still covered?",
    outcome: 'NOT_ELIGIBLE — §4.5 registered outside 14d',
    tone: 'expired',
  },
  {
    label: '7. ESCALATE · international customer',
    beCustomer: 'Ravi Kumar',
    orderNumber: 'JD-100040',
    email: 'ravi.kumar@example.in',
    text: "Hi, I'm calling from India. My email is ravi.kumar@example.in. I have order JD-100040, a Perseus 3 16mm, and it developed a soft spot after six weeks.",
    outcome: 'ESCALATE — outside warranty region',
    tone: 'escalate',
  },
  {
    label: '8. ESCALATE · gift, no order number',
    beCustomer: 'Grace Liu',
    email: 'grace.liu@example.com',
    text: "My email is grace.liu@example.com. I received a JOOLA Scorpeus 4 as a gift and I don't have the order number. The handle grip is already peeling.",
    outcome: 'ESCALATE — missing order info',
    tone: 'escalate',
  },
  {
    label: '9. WARRANTY EXPIRED · old purchase',
    beCustomer: 'John Smith',
    orderNumber: 'JD-099001',
    text: "My old Hyperion Original paddle is broken. Order JD-099001, purchased back in November 2024. Is there anything you can do?",
    outcome: 'WARRANTY_EXPIRED — outside 12mo window',
    tone: 'expired',
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
      "Subject: Warranty claim from India — JD-100040\n\nHello JOOLA team,\n\nI'm writing from Bangalore, India. My Perseus 3 16mm (JD-100040) developed a soft spot near the sweet spot about six weeks after purchase. NFC was registered on arrival. I understand JOOLA primarily ships from US — what's the process for an international warranty replacement?\n\nBest,\nRavi Kumar",
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
 * Collapsible "demo helper" panel.
 *
 * Voice cards show a compact name / order / email reference grid — you speak
 * these details into the call. Email/web cards show a 3-line text preview you
 * can copy verbatim. Clicking any card copies the full script to clipboard.
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
              {channel === 'voice'
                ? 'Speak these details — click any card to copy the full script'
                : 'Click any card to copy it to your clipboard'}
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
                  {/* Header: label + outcome chip */}
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="font-sans text-xs font-bold uppercase tracking-tight text-joola-black">
                      {s.label}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
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

                  {/* Voice: compact name / order / email reference grid */}
                  {channel === 'voice' ? (
                    <dl className="grid w-full grid-cols-[3rem_1fr] gap-x-2 gap-y-0.5">
                      {s.beCustomer && (
                        <>
                          <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Name</dt>
                          <dd className="font-mono text-[10px] font-medium text-joola-black">{s.beCustomer}</dd>
                        </>
                      )}
                      <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Order</dt>
                      <dd className="font-mono text-[10px] text-joola-black">{s.orderNumber ?? '—'}</dd>
                      <dt className="font-mono text-[9px] uppercase tracking-mega text-joola-stone">Email</dt>
                      <dd className="font-mono text-[10px] text-joola-black">{s.email ?? '—'}</dd>
                    </dl>
                  ) : (
                    /* Email / web: 3-line text preview */
                    <>
                      {s.beCustomer && (
                        <span className="font-mono text-[10px] uppercase tracking-mega text-joola-stone">
                          Switch to: <span className="text-joola-black">{s.beCustomer}</span>
                        </span>
                      )}
                      <span className="line-clamp-3 whitespace-pre-line text-xs text-joola-graphite">
                        {s.text}
                      </span>
                    </>
                  )}

                  <span
                    aria-hidden
                    className={cx(
                      'mt-auto font-mono text-[10px] uppercase tracking-mega',
                      copiedIdx === i ? 'text-joola-court-green' : 'text-joola-stone group-hover:text-joola-graphite',
                    )}
                  >
                    {copiedIdx === i ? 'Copied!' : 'Tap to copy script'}
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
