/* global React */

/* =====================================================
   CASE DETAIL DRAWER (slides in from right)
   ===================================================== */

function DecisionCard({ claim }) {
  const map = {
    ELIGIBLE_FOR_DAMAGE_REVIEW: { tone: 'ok', label: 'Eligible · damage review',
      reason: 'Purchase verified, customer is original purchaser, product was purchased from an authorized source, NFC registration was completed within 14 days, and receipt was uploaded and approved.',
      next: 'Ask customer to upload damage photos and a short video.' },
    NOT_ELIGIBLE: { tone: 'no', label: 'Not eligible',
      reason: 'Purchase source is outside JOOLA\'s authorized retailer network. Warranty does not apply.',
      next: 'Polite decline · offer human review if disputed.' },
    HUMAN_REVIEW_REQUIRED: { tone: 'review', label: 'Human review required',
      reason: 'Customer has reached the replacement limit for this product (3 of 3). Case requires CS judgment.',
      next: 'Route to CS team · respond within one business day.' },
    WARRANTY_EXPIRED: { tone: 'no', label: 'Warranty expired',
      reason: 'Based on purchase date and registration status, the warranty period has lapsed.',
      next: 'Empathetic decline · offer human review.' },
    PROCESSING: { tone: '', label: 'Processing',
      reason: 'Rule engine has not yet finished evaluating this case.',
      next: 'Awaiting agent handoff.' },
  };
  const d = map[claim.decision] || map.PROCESSING;
  return (
    <div className={`decision-card ${d.tone}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow" style={{ color: 'var(--ops-fg-3)' }}>Rule engine decision</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)', letterSpacing: '.08em' }}>DETERMINISTIC · v1.2</span>
      </div>
      <div className="verdict" style={{ marginTop: 8 }}>{d.label}</div>
      <div className="reason">{d.reason}</div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--ops-line)' }}>
        <span className="eyebrow" style={{ color: 'var(--ops-fg-3)' }}>Next step</span>
        <div style={{ fontSize: 12, color: 'var(--ops-fg), marginTop: 4', marginTop: 4 }}>{d.next}</div>
      </div>
    </div>
  );
}

function Timeline({ steps }) {
  return (
    <div className="timeline">
      {steps.map((s) => (
        <div key={s.id} className={`tl-step is-${s.status}`}>
          <div className="rail"><div className="dot"></div></div>
          <div className="card">
            <div className="name">
              <span>{s.glyph} · {s.name}</span>
              <span className="time">{s.status === 'pending' ? 'PENDING' : s.time}</span>
            </div>
            <div className="desc">{s.role}</div>
            {s.io && (
              <div className="io">
                <div>→ <b>in:</b> {s.io.in}</div>
                <div>← <b>out:</b> {s.io.out}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CaseDrawer({ claim, open, onClose, archived, onReopen }) {
  const drafts = React.useMemo(() => claim ? CS.buildDrafts(claim) : null, [claim]);
  const steps  = React.useMemo(() => claim ? CS.buildTimeline(claim) : [],   [claim]);
  if (!claim) {
    return <>
      <div className="drawer-scrim" onClick={onClose}></div>
      <aside className="drawer"></aside>
    </>;
  }

  const channelLabel = { voice: 'PHONE CALL', email: 'EMAIL', web: 'WEB FORM' }[claim.channel] || claim.channel.toUpperCase();

  return (
    <>
      <div className={`drawer-scrim ${open ? 'is-open' : ''}`} onClick={onClose}></div>
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        <div className="drawer__hdr">
          <div>
            <div className="id mono">CASE {claim.id} · {channelLabel}
              {archived && <span className="chip" style={{ marginLeft: 8, background: 'var(--ops-panel-3)', color: 'var(--ops-fg-2)' }}>ARCHIVED · {archived.status}</span>}
            </div>
            <h2>{claim.customer.name}</h2>
            <div className="sub">
              <span className="mono">{claim.customer.email}</span> · {claim.customer.country}
              {claim.customer.phone && <> · <span className="mono">{claim.customer.phone}</span></>}
              {archived && <> · opened <span className="mono">{CS.fmtDateTime(archived.createdAt)}</span>
                {archived.closedAt && <> · closed <span className="mono">{CS.fmtDateTime(archived.closedAt)}</span></>}</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {archived && onReopen && (
              <button
                onClick={onReopen}
                style={{
                  padding: '8px 14px',
                  background: 'var(--ops-yellow)',
                  color: 'var(--joola-black)',
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                }}
                title="Send back to Live operations"
              >
                Reopen → Live
              </button>
            )}
            <button className="drawer__close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="drawer__body">

          <div className="section">
            <div className="section__h">
              <span className="eyebrow">Issue reported</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ops-fg)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--ops-bg)', border: '1px solid var(--ops-line)' }}>
              "{claim.issue}"
            </div>
          </div>

          <div className="section">
            <DecisionCard claim={claim} />
          </div>

          <div className="section">
            <div className="section__h">
              <span className="eyebrow">Purchase + registration</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}>VERIFIED · READ-ONLY</span>
            </div>
            <dl className="kv">
              <dt>Order #</dt>          <dd className="mono">{claim.order.number}</dd>
              <dt>Product</dt>          <dd>{claim.order.product}</dd>
              <dt>SKU</dt>              <dd className="mono">{claim.order.sku}</dd>
              <dt>Purchase date</dt>    <dd className="mono">{claim.order.purchaseDate}</dd>
              <dt>Source</dt>           <dd>{claim.order.source} {claim.order.authorized ? <span className="chip yellow" style={{ marginLeft: 8 }}>AUTHORIZED</span> : <span className="chip" style={{ marginLeft: 8, background: 'rgba(255,58,76,0.15)', color: 'var(--ops-red)' }}>UNAUTHORIZED</span>}</dd>
              <dt>NFC registered</dt>   <dd>{claim.registration.registered ? <>Yes · <span className="mono">{claim.registration.nfcId}</span></> : <span style={{ color: 'var(--ops-fg-3)' }}>Not found</span>}</dd>
              <dt>Within 14 days?</dt>  <dd>{claim.registration.registered ? (claim.registration.withinWindow ? 'Yes' : <span style={{ color: 'var(--ops-orange)' }}>No · late</span>) : '—'}</dd>
              <dt>Receipt approved</dt> <dd>{claim.registration.registered ? (claim.registration.receiptApproved ? 'Yes' : 'Pending') : '—'}</dd>
            </dl>
          </div>

          <div className="section">
            <div className="section__h">
              <span className="eyebrow">Agent journey</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}>7 AGENTS · 1 PIPELINE</span>
            </div>
            <Timeline steps={steps} />
          </div>

          <div className="section">
            <div className="section__h">
              <span className="eyebrow">AI drafts · awaiting CS review</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}>NOT SENT</span>
            </div>
            <div className="drafts">
              <div className="draft-card">
                <h5>VOICE REPLY · VAPI</h5>
                <div className="sub">~ 15 sec · friendly</div>
                <div className="body">"{drafts.voice}"</div>
              </div>
              <div className="draft-card">
                <h5>EMAIL DRAFT</h5>
                <div className="sub">Subject: {drafts.email.subject}</div>
                <div className="body">{drafts.email.body}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px 14px', background: 'var(--ops-yellow)', color: 'var(--joola-black)', fontWeight: 800, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>
                Approve + Send →
              </button>
              <button style={{ padding: '10px 14px', border: '1px solid var(--ops-line-2)', color: 'var(--ops-fg)', fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>
                Edit
              </button>
              <button style={{ padding: '10px 14px', border: '1px solid var(--ops-line-2)', color: 'var(--ops-red)', fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>
                Escalate
              </button>
            </div>
          </div>

          <div className="section">
            <div className="section__h">
              <span className="eyebrow">Internal CS summary</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ops-fg-2)', lineHeight: 1.55, padding: 12, background: 'var(--ops-panel-2)', border: '1px solid var(--ops-line)', borderLeft: '3px solid var(--ops-yellow)' }}>
              {drafts.summary}
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}

Object.assign(window, { CaseDrawer });
