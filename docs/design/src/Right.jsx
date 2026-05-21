/* global React */

/* =====================================================
   PIPELINE (right column - top)
   ===================================================== */
function Pipeline({ stages }) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Claim pipeline
          <span className="count mono">{total} ACTIVE</span>
        </div>
        <div className="panel__hdr-actions">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ops-fg-3)', letterSpacing: '.1em' }}>
            TODAY
          </span>
        </div>
      </div>
      <div className="panel__body">
        <div className="pipeline">
          {stages.map(s => (
            <div key={s.id} className={`stage-row ${s.active ? 'is-active' : ''} ${s.stuck > 0 ? 'is-stuck' : ''}`}>
              <div className="node"></div>
              <div className="name">
                {s.name}
                <span>{s.sub}</span>
              </div>
              <div className="meta">
                {s.count}
                <span>
                  {s.stuck > 0 ? <span style={{ color: 'var(--ops-red)' }}>{s.stuck} stuck</span> : `avg ${s.avg}`}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="deccol" style={{ borderTop: '1px solid var(--ops-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="eyebrow">Decision mix · today</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}>{total + 71} TOTAL</span>
          </div>
          <div className="bars">
            {CS.seedDecisionMix().map(d => (
              <div key={d.id} className={`decbar ${d.id}`}>
                <span className="lbl">{d.label}</span>
                <span className="val">{d.value}</span>
                <div className="track"><i style={{ width: `${d.value}%` }}></i></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   ESCALATIONS QUEUE (right column - bottom)
   ===================================================== */
function EscalationItem({ esc, onClaim }) {
  const prioLabel = { urgent: 'URGENT · ' + esc.waitMin + 'm', high: 'HIGH · ' + esc.waitMin + 'm', norm: 'NORM · ' + esc.waitMin + 'm' };
  return (
    <div className={`esc is-${esc.priority}`}>
      <div className="esc__top">
        <div className="esc__cust">
          {esc.cust} <em>· <span className="mono">{esc.id}</span></em>
        </div>
        <div className="esc__prio">{prioLabel[esc.priority]}</div>
      </div>
      <div className="esc__reason">{esc.summary}</div>
      <div className="esc__foot">
        <span>REASON · {esc.reason}</span>
        <button onClick={() => onClaim && onClaim(esc)}>CLAIM →</button>
      </div>
    </div>
  );
}

function Escalations({ items, onClaim }) {
  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Human escalations
          <span className="count mono">{items.length} WAITING</span>
        </div>
        <div className="panel__hdr-actions">
          <button className="icon-btn" title="Filter">⇅</button>
        </div>
      </div>
      <div className="panel__body">
        <div className="escq">
          {items.map(e => <EscalationItem key={e.id} esc={e} onClaim={onClaim} />)}
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   VOLUME CHART (lives at bottom of left column area as a footer)
   ===================================================== */
function VolumeChart({ samples }) {
  const max = Math.max(...samples, 1);
  return (
    <div className="mc">
      <div className="mc__h">
        <span className="eyebrow">Volume · last 24h</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ops-fg-3)' }}>{samples.reduce((a,b)=>a+b,0)} INQUIRIES</span>
      </div>
      <div className="spark-tall">
        {samples.map((v, i) => (
          <i key={i} className={i === samples.length - 1 ? 'now' : ''} style={{ height: `${(v / max) * 100}%` }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ops-fg-4)', marginTop: 4, letterSpacing: '.08em' }}>
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>NOW</span>
      </div>
    </div>
  );
}

Object.assign(window, { Pipeline, Escalations, VolumeChart });
