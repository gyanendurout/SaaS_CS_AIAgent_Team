/* ===========================================================
   ARCHIVE / HISTORICAL TICKETS
   ~280 tickets across 30 days. Weighted toward recent.
   =========================================================== */

const ARCHIVE_ISSUES = [
  "Paddle face cracked along the edge",
  "Edge guard came loose during play",
  "Handle grip is peeling off",
  "Hairline crack near throat area",
  "Dead spot on the face — sounds hollow",
  "Surface delaminating around the perimeter",
  "Paddle warped after one week of play",
  "NFC chip not reading in the app",
  "Receipt was uploaded but never approved",
  "Order arrived but paddle was damaged in box",
  "Replacement paddle has the same defect",
  "Grip wrap unraveling after light use",
  "Cosmetic chip near the corner",
  "Paddle face has bubbling under the surface",
  "Eyewear hinge snapped on first use",
  "Bag zipper broke within a month",
  "Net pole bent during normal assembly",
  "Returning a gift — wrong paddle model",
  "Question about warranty registration window",
  "Paddle sounds different after one session",
];

const RESOLUTIONS = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: ['Replacement shipped', 'Damage photos approved', 'Awaiting customer photos'],
  NOT_ELIGIBLE: ['Polite decline · case closed', 'Customer informed · unauthorized seller', 'Outside coverage region'],
  HUMAN_REVIEW_REQUIRED: ['Escalated to CS lead', 'Reviewed · replacement granted', 'Reviewed · declined'],
  WARRANTY_EXPIRED: ['Polite decline · expired', 'Outside coverage window'],
  PROCESSING: ['In progress', 'Waiting on customer reply', 'Pending verification'],
};

const STATUSES = ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', 'OPEN', 'OPEN', 'REOPENED'];

const CS_AGENTS_HUMAN = [
  'Aisha Liu', 'Marcus Yen', 'Diego Rivera', 'Hannah Bauer',
  'Trevor Smith', 'Nadia Costa', 'Jordan West', 'Imani Foster',
];

CS.seedArchive = (n = 280) => {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    // weighted toward recent (more in last 7d)
    const dayWeight = Math.pow(Math.random(), 1.6); // skewed toward 0
    const dayOffset = Math.floor(dayWeight * 30);   // 0..29 days back
    const hourOffset = randInt(8, 20);
    const minOffset = randInt(0, 59);
    const ts = new Date(now - dayOffset * 86400000);
    ts.setHours(hourOffset, minOffset, randInt(0, 59), 0);

    const name = pick(CS.NAMES);
    const product = Math.random() < 0.85 ? pick(CS.PRODUCTS.slice(0, 5)) : pick(CS.PRODUCTS.slice(5));
    const decisionRoll = Math.random();
    let decision;
    if (decisionRoll < 0.62) decision = 'ELIGIBLE_FOR_DAMAGE_REVIEW';
    else if (decisionRoll < 0.78) decision = 'NOT_ELIGIBLE';
    else if (decisionRoll < 0.91) decision = 'HUMAN_REVIEW_REQUIRED';
    else if (decisionRoll < 0.98) decision = 'WARRANTY_EXPIRED';
    else decision = 'PROCESSING';

    // STATUS depends on decision + age
    let status;
    if (decision === 'PROCESSING') status = 'OPEN';
    else if (dayOffset < 2 && Math.random() < 0.35) status = 'OPEN';
    else if (Math.random() < 0.04) status = 'REOPENED';
    else status = 'CLOSED';

    const channel = (() => {
      const r = Math.random();
      if (r < 0.42) return 'email';
      if (r < 0.78) return 'voice';
      return 'web';
    })();

    const closedAtOffset = status === 'CLOSED' ? randInt(60, 3 * 86400) * 1000 : 0;
    const handleSec = status === 'CLOSED' ? randInt(40, 720) : 0;

    out.push({
      id: `WC-${10000 + i + 1}`,
      createdAt: ts,
      closedAt: status === 'CLOSED' ? new Date(ts.getTime() + closedAtOffset) : null,
      handleSec,
      status,
      channel,
      customer: { name, email: `${slug(name)}@example.com`, country: Math.random() > 0.08 ? 'US' : (Math.random() > 0.5 ? 'CA' : 'IN') },
      order: {
        number: `${1000 + i}`,
        product: product.name,
        sku: product.sku,
        type: product.type,
        purchaseDate: '2026-0' + randInt(1,4) + '-' + pad(randInt(1, 28)),
        source: Math.random() > 0.15 ? 'JOOLA Website' : (Math.random() > 0.6 ? 'Authorized Retailer' : 'eBay'),
        authorized: Math.random() > 0.08,
      },
      registration: {
        registered: Math.random() > 0.3,
        nfcId: `NFC-${randInt(1000, 9999)}`,
        withinWindow: Math.random() > 0.25,
        receiptApproved: true,
      },
      issue: pick(ARCHIVE_ISSUES),
      decision,
      resolution: pick(RESOLUTIONS[decision] || RESOLUTIONS.PROCESSING),
      assignedAgent: Math.random() < 0.85 ? null : pick(CS_AGENTS_HUMAN), // 15% had human touch
      // each ticket had a primary AI agent that finalized it
      primaryAgent: decision === 'HUMAN_REVIEW_REQUIRED' ? 'esc'
                  : decision === 'NOT_ELIGIBLE' ? 'rules'
                  : decision === 'WARRANTY_EXPIRED' ? 'rules'
                  : 'response',
      stage: status === 'OPEN' ? pick(['intake', 'verify', 'rules', 'draft']) : 'closed',
      reopenable: status === 'CLOSED',
    });
  }
  // sort newest first
  return out.sort((a, b) => b.createdAt - a.createdAt);
};

/* ----- Date helpers for the archive UI ----- */
CS.fmtDateTime = (d) => {
  if (!d) return '—';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
CS.fmtDate = (d) => {
  if (!d) return '—';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${pad(d.getDate())} ${months[d.getMonth()]}`;
};
CS.fmtDuration = (s) => {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
