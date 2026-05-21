/* ===========================================================
   MOCK DATA + LIVE SIMULATION
   Drives the dashboard with realistic-feeling activity.
   =========================================================== */

window.CS = window.CS || {};

CS.AGENTS = [
  {
    id: 'intake',  name: 'Intake',          glyph: '01',
    role: 'Receives + classifies inquiry',
    capacity: 30,
  },
  {
    id: 'shopify', name: 'Shopify Verify',  glyph: '02',
    role: 'Looks up purchase in Shopify',
    capacity: 24,
  },
  {
    id: 'warrreg', name: 'Warranty Reg',    glyph: '03',
    role: 'Checks NFC registration DB',
    capacity: 24,
  },
  {
    id: 'rules',   name: 'Rule Engine',     glyph: '04',
    role: 'Applies deterministic policy',
    capacity: 60,
  },
  {
    id: 'summary', name: 'Claim Summary',   glyph: '05',
    role: 'Builds claim record + summary',
    capacity: 40,
  },
  {
    id: 'response',name: 'Customer Reply',  glyph: '06',
    role: 'Drafts email + voice reply',
    capacity: 20,
  },
  {
    id: 'esc',     name: 'Human Escalation',glyph: '07',
    role: 'Hands off to CS team',
    capacity: 12,
  },
];

CS.PRODUCTS = [
  { name: 'JOOLA Perseus Paddle',  sku: 'J-PERSEUS-001',   type: 'paddle' },
  { name: 'JOOLA Hyperion Paddle', sku: 'J-HYPERION-001',  type: 'paddle' },
  { name: 'JOOLA Scorpeus Paddle', sku: 'J-SCORPEUS-001',  type: 'paddle' },
  { name: 'JOOLA Agassi Paddle',   sku: 'J-AGASSI-001',    type: 'paddle' },
  { name: 'JOOLA Magnus Paddle',   sku: 'J-MAGNUS-001',    type: 'paddle' },
  { name: 'JOOLA Pickleball Balls',sku: 'J-BALLS-001',     type: 'balls'  },
  { name: 'JOOLA Tour Bag',        sku: 'J-BAG-001',       type: 'bag'    },
  { name: 'JOOLA Eyewear Pro',     sku: 'J-EYE-001',       type: 'eyewear'},
];

CS.NAMES = [
  'John Smith','Sarah Lee','Mike Brown','Alex Green','Ravi Kumar','Emily White','Chris Wilson',
  'Maria Garcia','David Park','Lauren Chen','Tomás Rivera','Hannah Cole','Jamal Wright','Priya Shah',
  'Olivia Reed','Daniel Kim','Sofia Martinez','Ben Carter','Aisha Khan','Marcus Hall',
];

CS.STAGES = [
  { id: 'intake',  name: 'Intake',          sub: 'Receive + classify' },
  { id: 'verify', name: 'Verifying',        sub: 'Shopify + Warranty DB' },
  { id: 'rules',  name: 'Policy applied',   sub: 'Rule engine decision' },
  { id: 'draft',  name: 'Response drafted', sub: 'Email + voice' },
  { id: 'closed', name: 'Resolved / closed',sub: 'Awaiting customer' },
];

CS.DECISIONS = [
  { id: 'ELIGIBLE_FOR_DAMAGE_REVIEW', label: 'Eligible · damage review', tone: 'eligible',     short: 'ELIGIBLE' },
  { id: 'NOT_ELIGIBLE',               label: 'Not eligible',             tone: 'not-eligible', short: 'NOT ELIG.' },
  { id: 'WARRANTY_EXPIRED',           label: 'Warranty expired',         tone: 'expired',      short: 'EXPIRED' },
  { id: 'HUMAN_REVIEW_REQUIRED',      label: 'Human review',             tone: 'review',       short: 'REVIEW' },
  { id: 'PROCESSING',                 label: 'Processing',               tone: 'processing',   short: 'PROCESSING' },
];

/* ----- Helpers ----- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g,'.');
CS.helpers = { pick, randInt, pad, fmtTime, slug };

/* ----- Initial KPI seed ----- */
CS.seedKPI = () => ({
  callsToday:   137,
  emailsToday:  214,
  webForms:     58,
  openClaims:   23,
  autoResolve:  82,   // %
  avgHandle:    144,  // seconds
  escalations:  6,
  slaBreach:    2,
});

/* ----- Seed agent states ----- */
CS.seedAgents = () => CS.AGENTS.map((a, i) => {
  // initial mix of states
  const states = ['busy','busy','busy','idle','idle','blocked','busy'];
  const state = states[i] || 'idle';
  return {
    ...a,
    state,
    queue: state === 'idle' ? 0 : randInt(2, 8),
    handled: randInt(40, 180),
    avgMs: randInt(220, 1400),
    load: state === 'idle' ? 0 : randInt(30, 95),
    currentTaskFor: state === 'idle' ? null : `WC-${10000 + randInt(1, 300)}`,
    currentTask: null, // filled below
  };
});

/* ----- Build an in-progress case ----- */
const PADDLE_ISSUES = [
  "Paddle face cracked after a hard slam",
  "Edge guard came loose during play",
  "Handle grip starting to peel off",
  "Hairline crack near throat area",
  "Core sounds dead, very dampened response",
  "Surface delaminating around the edge",
];

CS.buildClaim = (overrides = {}) => {
  const name = pick(CS.NAMES);
  const email = `${slug(name)}@example.com`;
  const product = pick(CS.PRODUCTS.slice(0, 5)); // paddles only mostly
  const id = `WC-${10000 + randInt(1, 999)}`;
  return {
    id,
    customer: { name, email, country: Math.random() > 0.1 ? 'US' : 'CA' },
    order: {
      number: `${1000 + randInt(1, 800)}`,
      product: product.name,
      sku: product.sku,
      type: product.type,
      purchaseDate: '2026-01-' + pad(randInt(2, 28)),
      source: Math.random() > 0.15 ? 'JOOLA Website' : 'Authorized Retailer',
      authorized: true,
    },
    registration: {
      registered: Math.random() > 0.3,
      nfcId: `NFC-${randInt(1000,9999)}`,
      receiptApproved: true,
      withinWindow: Math.random() > 0.25,
    },
    issue: pick(PADDLE_ISSUES),
    channel: pick(['voice','email','web','email','voice','email']),
    stage: pick(['intake','verify','rules','draft','closed']),
    decision: pick(['ELIGIBLE_FOR_DAMAGE_REVIEW','ELIGIBLE_FOR_DAMAGE_REVIEW','ELIGIBLE_FOR_DAMAGE_REVIEW','NOT_ELIGIBLE','WARRANTY_EXPIRED','HUMAN_REVIEW_REQUIRED','PROCESSING']),
    sentiment: Math.random(),
    createdAt: new Date(Date.now() - randInt(15, 1800) * 1000),
    ...overrides,
  };
};

/* ----- Initial feed (last hour activity) ----- */
CS.seedFeed = () => {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const claim = CS.buildClaim();
    out.push(claim);
  }
  // sort by createdAt desc
  return out.sort((a,b) => b.createdAt - a.createdAt);
};

/* ----- Hand-crafted active calls (with scripted transcript) ----- */
CS.seedActiveCalls = () => [
  {
    id: 'CALL-9831',
    customer: { name: 'Priya Shah', email: 'priya.shah@example.com', country: 'US', phone: '+1 415 555 0181' },
    order: { number: '1042', product: 'JOOLA Perseus Paddle', sku: 'J-PERSEUS-001', purchaseDate: '2026-02-04', source: 'JOOLA Website', authorized: true },
    registration: { registered: true, nfcId: 'NFC-4421', withinWindow: true, receiptApproved: true },
    channel: 'voice',
    stage: 'rules',
    decisionPreview: 'ELIGIBLE_FOR_DAMAGE_REVIEW',
    sentiment: 0.78,
    startedAt: new Date(Date.now() - 92 * 1000),
    transcript: [
      { who: 'CUSTOMER', txt: "Hi, my Perseus paddle cracked along the edge during a tournament yesterday." },
      { who: 'AI',       txt: "I'm sorry to hear that. Can I get the email on your JOOLA account?" },
      { who: 'CUSTOMER', txt: "Sure, it's priya dot shah at example dot com." },
      { who: 'AI',       txt: "Found it — order 1042, Perseus paddle, purchased Feb 4." },
      { who: 'AI',       txt: "I can see NFC registration was completed 6 days after purchase with an approved receipt." },
      { who: 'AI',       txt: "That gives you the 12-month extended warranty, and it's active." },
      { who: 'CUSTOMER', txt: "Oh great. So what happens now?" },
      { who: 'AI',       txt: "I'll send you a short list of damage photos to upload, then our team reviews within 24 hours." },
    ],
    transcriptIdx: 4, // currently played up to line 4
  },
  {
    id: 'CALL-9832',
    customer: { name: 'Marcus Hall', email: 'marcus.hall@example.com', country: 'US', phone: '+1 312 555 0144' },
    order: { number: '987', product: 'JOOLA Hyperion Paddle', sku: 'J-HYPERION-001', purchaseDate: '2025-09-18', source: 'eBay', authorized: false },
    registration: { registered: false },
    channel: 'voice',
    stage: 'verify',
    decisionPreview: 'NOT_ELIGIBLE',
    sentiment: 0.32,
    startedAt: new Date(Date.now() - 58 * 1000),
    transcript: [
      { who: 'CUSTOMER', txt: "My Hyperion paddle broke and I want a replacement." },
      { who: 'AI',       txt: "I can help with that. May I have your order number?" },
      { who: 'CUSTOMER', txt: "Order is 987, bought through eBay back in September." },
      { who: 'AI',       txt: "I see — the purchase source appears to be eBay rather than JOOLA or an authorized retailer." },
      { who: 'AI',       txt: "Let me run one more check on the warranty policy for that case." },
      { who: 'CUSTOMER', txt: "What does that mean? Am I covered or not?" },
      { who: 'AI',       txt: "Unfortunately, unauthorized resellers aren't covered under JOOLA's warranty. I can still escalate this to a human agent for review." },
    ],
    transcriptIdx: 3,
  },
];

/* ----- Decision mix snapshot ----- */
CS.seedDecisionMix = () => ([
  { id: 'eligible', label: 'Eligible · damage review', value: 64, max: 100 },
  { id: 'review',   label: 'Human review required',   value: 14, max: 100 },
  { id: 'notelig',  label: 'Not eligible',            value: 16, max: 100 },
  { id: 'expired',  label: 'Warranty expired',        value:  6, max: 100 },
]);

/* ----- Pipeline counts ----- */
CS.seedPipeline = () => ([
  { id: 'intake', name: 'Intake',         sub: 'Receive + classify',        count: 12, stuck: 0, avg: '02s', active: true },
  { id: 'verify', name: 'Verifying',      sub: 'Shopify + Warranty DB',     count: 23, stuck: 2, avg: '08s', active: true },
  { id: 'rules',  name: 'Policy applied', sub: 'Rule engine decision',      count: 18, stuck: 0, avg: '01s', active: true },
  { id: 'draft',  name: 'Response drafted',sub: 'Email + voice draft',      count:  9, stuck: 1, avg: '04s', active: true },
  { id: 'closed', name: 'Resolved / closed', sub: 'Awaiting customer / sent',count: 71, stuck: 0, avg: '—',   active: false },
]);

/* ----- Escalations queue ----- */
CS.seedEscalations = () => ([
  {
    id: 'WC-10218',
    cust: 'Emily White',
    summary: 'Replacement limit reached — 3 prior replacements on Perseus paddle. Customer asking for fourth.',
    reason: 'REPLACEMENT_LIMIT_REACHED',
    priority: 'urgent',
    waitMin: 4,
  },
  {
    id: 'WC-10214',
    cust: 'Ravi Kumar',
    summary: 'Customer in India, purchased from JOOLA US site. Wants warranty replacement.',
    reason: 'OUTSIDE_REGION',
    priority: 'high',
    waitMin: 11,
  },
  {
    id: 'WC-10211',
    cust: 'Alex Green',
    summary: 'Disputes eBay = unauthorized. Says seller was "official" JOOLA storefront.',
    reason: 'DISPUTED_SELLER',
    priority: 'high',
    waitMin: 18,
  },
  {
    id: 'WC-10203',
    cust: 'Hannah Cole',
    summary: 'Photos unclear — damage could be wear-and-tear or manufacturing.',
    reason: 'AMBIGUOUS_DAMAGE',
    priority: 'norm',
    waitMin: 32,
  },
  {
    id: 'WC-10198',
    cust: 'Daniel Kim',
    summary: 'Customer mentioned social media — handle with care.',
    reason: 'BRAND_RISK',
    priority: 'norm',
    waitMin: 41,
  },
]);

/* ----- 24h volume samples (hourly buckets) ----- */
CS.seedVolume = () => {
  // 24 hourly buckets. Higher in midday.
  return Array.from({length: 24}, (_, h) => {
    const peak = h >= 9 && h <= 18 ? 1 : 0.35;
    return Math.round((randInt(4, 16) + 8) * peak);
  });
};

/* ----- Pretend Claude internal summary + drafts ----- */
CS.buildDrafts = (claim) => {
  const cust = claim.customer.name.split(' ')[0];
  if (claim.decision === 'NOT_ELIGIBLE') {
    return {
      summary: `Customer ${claim.customer.name} reports damage to ${claim.order.product} purchased via ${claim.order.source}. The purchase source is not an authorized JOOLA retailer, which excludes the order from warranty coverage. Recommend polite refusal with offer of human review.`,
      email: {
        subject: 'Warranty Claim Update — Purchase Source',
        body: `Hi ${cust},\n\nThank you for reaching out about your ${claim.order.product}. After reviewing order ${claim.order.number}, we're unable to verify the purchase through an authorized JOOLA source.\n\nJOOLA's warranty only covers paddles purchased from JOOLA directly or from authorized retailers. Because of that, we can't process a warranty replacement on this order.\n\nIf you believe this is a mistake, reply to this email and we'll route the case to a human agent for review.\n\nThank you,\nJOOLA Customer Support`,
      },
      voice: `I found the purchase, but it looks like it's from a marketplace outside of our authorized network, so it's not covered by JOOLA's warranty. I can still create a case for our team to review if you'd like.`,
    };
  }
  if (claim.decision === 'HUMAN_REVIEW_REQUIRED') {
    return {
      summary: `Customer ${claim.customer.name} reached the maximum number of warranty replacements (${3}) on ${claim.order.sku}. Escalating to CS team for case-by-case review.`,
      email: {
        subject: 'Warranty Claim Requires Review',
        body: `Hi ${cust},\n\nThanks for getting in touch about your ${claim.order.product}. I can see this would be your 4th replacement on this paddle model, which exceeds our standard policy of 3.\n\nI'm escalating this case to our customer service team so they can review it with you directly. You'll hear from someone within one business day.\n\nThank you,\nJOOLA Customer Support`,
      },
      voice: `It looks like the maximum number of replacements may already have been reached on this paddle. I'm going to send this to our team for review and someone will follow up within one business day.`,
    };
  }
  if (claim.decision === 'WARRANTY_EXPIRED') {
    return {
      summary: `Customer ${claim.customer.name} has a verified purchase but the warranty period has lapsed. Polite empathy + offer human review.`,
      email: {
        subject: 'Warranty Claim Update — Warranty Period',
        body: `Hi ${cust},\n\nThanks for reaching out about your ${claim.order.product}. I checked order ${claim.order.number} — based on the purchase date and registration status, the warranty period for this paddle has expired.\n\nI know that's not what you were hoping to hear. If you'd like, I can route this case to a human agent for a closer look.\n\nThank you,\nJOOLA Customer Support`,
      },
      voice: `Based on the purchase date and registration status, this paddle's warranty has expired. I'm sorry about that — I can route the case to our team if you'd like a closer look.`,
    };
  }
  // default ELIGIBLE
  return {
    summary: `Customer ${claim.customer.name} purchased ${claim.order.product} on ${claim.order.purchaseDate}. NFC registration confirmed within 14 days with approved receipt — qualifies for 12-month extended warranty. Warranty currently active. Recommend requesting damage photos for review.`,
    email: {
      subject: 'Warranty Claim Received — Damage Review Required',
      body: `Hi ${cust},\n\nThank you for contacting us about your ${claim.order.product}. I've verified order ${claim.order.number} and confirmed NFC registration was completed within 14 days with an approved receipt — that qualifies you for the 12-month extended warranty, which is currently active.\n\nTo complete the review, please reply with:\n  • Full front photo of the paddle\n  • Full back photo of the paddle\n  • Close-up of the damaged area\n  • NFC / serial area photo if visible\n\nOur team will review within 24 hours and follow up with next steps.\n\nThank you,\nJOOLA Customer Support`,
    },
    voice: `I found your purchase and confirmed your paddle was registered within 14 days with a valid receipt. That gives you the 12-month warranty, and it's currently active. The next step is to upload a few damage photos so our team can review the claim.`,
  };
};

/* ----- Build a per-claim agent timeline ----- */
CS.buildTimeline = (claim) => {
  // 7 agents, each gets a step. Past stages are "done", current is "current", future is "pending"
  const stageMap = { intake: 0, verify: 2, rules: 3, draft: 5, closed: 6 };
  const currentStep = stageMap[claim.stage] ?? 6;
  const isFailedAt = claim.decision === 'NOT_ELIGIBLE' ? 3 :
                     claim.decision === 'WARRANTY_EXPIRED' ? 3 :
                     claim.decision === 'HUMAN_REVIEW_REQUIRED' ? 6 : -1;

  const ioByAgent = {
    intake: { in: `email=${claim.customer.email}`, out: `intent=WARRANTY_CLAIM · order#=${claim.order.number}` },
    shopify:{ in: `lookup(${claim.order.number})`, out: `${claim.order.product} · ${claim.order.purchaseDate} · src=${claim.order.source}` },
    warrreg:{ in: `lookup(${claim.customer.email})`, out: claim.registration.registered ? `nfc=${claim.registration.nfcId} · within14d=${claim.registration.withinWindow}` : `not_found` },
    rules:  { in: `policyCheck(...)`, out: `decision=${claim.decision}` },
    summary:{ in: `decision=${claim.decision}`, out: `claimId=${claim.id}` },
    response:{ in: `decision=${claim.decision}`, out: `email + voice drafted` },
    esc:    { in: `reason=${claim.decision}`, out: claim.decision === 'HUMAN_REVIEW_REQUIRED' ? `routed to CS team` : `skipped` },
  };

  return CS.AGENTS.map((a, i) => {
    let status;
    if (i < currentStep) status = 'done';
    else if (i === currentStep) status = 'current';
    else status = 'pending';
    if (isFailedAt === i && claim.decision !== 'ELIGIBLE_FOR_DAMAGE_REVIEW' && claim.decision !== 'PROCESSING') status = 'done';
    if (a.id === 'esc' && claim.decision === 'HUMAN_REVIEW_REQUIRED') status = 'current';
    return {
      ...a,
      status,
      time: status === 'pending' ? '—' : `${randInt(80, 1800)}ms`,
      io: status === 'pending' ? null : ioByAgent[a.id],
    };
  });
};
