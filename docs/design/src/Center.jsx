/* global React */
const { useState: useStateLC, useEffect: useEffectLC, useRef: useRefLC, useMemo: useMemoLC } = React;

/* =====================================================
   ACTIVE CALLS (top of center column)
   ===================================================== */
function Waveform({ active }) {
  // 22 bars, randomize on mount; if not active, freeze flat
  const bars = useMemoLC(() => Array.from({ length: 22 }, () => Math.random()), []);
  return (
    <div className="call__wave" aria-hidden="true">
      {bars.map((b, i) => (
        <i
          key={i}
          style={{
            animationDelay: `${i * 60}ms`,
            animationPlayState: active ? 'running' : 'paused',
            height: active ? undefined : `${20 + b * 30}%`,
          }}
        />
      ))}
    </div>
  );
}

function SentimentBar({ value }) {
  const tone = value > 0.6 ? '' : value > 0.4 ? 'sentiment--neutral' : 'sentiment--negative';
  const label = value > 0.6 ? 'Positive' : value > 0.4 ? 'Neutral' : 'Frustrated';
  return (
    <div className={`sentiment ${tone}`}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ops-fg-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </span>
      <div className="sentiment__bar"><i style={{ width: `${value * 100}%` }}></i></div>
    </div>
  );
}

function CallCard({ call, onOpen }) {
  // Display the last 4 transcript lines based on transcriptIdx
  const upTo = Math.max(0, call.transcriptIdx);
  const lines = call.transcript.slice(Math.max(0, upTo - 3), upTo + 1);

  const elapsed = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;

  const decisionLabel = {
    ELIGIBLE_FOR_DAMAGE_REVIEW: 'ELIGIBLE',
    NOT_ELIGIBLE: 'NOT ELIGIBLE',
    HUMAN_REVIEW_REQUIRED: 'HUMAN REVIEW',
    WARRANTY_EXPIRED: 'EXPIRED',
    PROCESSING: 'PROCESSING',
  }[call.decisionPreview] || 'PROCESSING';

  return (
    <div className="call">
      <div className="call__head">
        <div>
          <div className="call__id mono">{call.id} · {call.channel.toUpperCase()}</div>
          <div className="call__customer">{call.customer.name}</div>
          <div className="call__sub">
            <span className="mono">{call.customer.email}</span> · {call.customer.country}
            {call.customer.phone && <> · <span className="mono">{call.customer.phone}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`call__channel call__channel--${call.channel}`}>
            {call.channel === 'voice' && '◉'} {call.channel === 'email' && '✉'} {call.channel === 'web' && '▤'} {call.channel}
          </span>
          <Waveform active={call.channel === 'voice'} />
        </div>
      </div>

      <div className="call__transcript">
        {lines.map((line, i) => (
          <div
            key={`${call.id}-${upTo}-${i}`}
            className={`tline ${line.who === 'CUSTOMER' ? 'who-cust' : 'who-ai'} ${i < lines.length - 1 ? 'is-fading' : ''}`}
          >
            <span className="who">{line.who === 'CUSTOMER' ? 'CUST' : 'AI ▸'}</span>
            <span className="txt">{line.txt}</span>
          </div>
        ))}
        {upTo < call.transcript.length - 1 && (
          <div className="tline who-cust" style={{ opacity: 0.4 }}>
            <span className="who" style={{ color: 'var(--ops-fg-4)' }}>···</span>
            <span className="txt" style={{ color: 'var(--ops-fg-4)' }}>listening…</span>
          </div>
        )}
      </div>

      <div className="call__footer">
        <span className="stage">
          STAGE · <b>{call.stage.toUpperCase()}</b>
        </span>
        <SentimentBar value={call.sentiment} />
        <span className="timer">
          ⟶ <span className="chip">{decisionLabel}</span> <span className="mono" style={{ marginLeft: 8 }}>{mm}:{CS.helpers.pad(ss)}</span>
        </span>
      </div>

      <button
        onClick={() => onOpen && onOpen(call)}
        style={{
          position: 'absolute', top: 12, right: 12,
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--ops-fg-3)', padding: '2px 6px',
          border: '1px solid var(--ops-line)',
        }}
        title="Open case"
      >
        OPEN ⤤
      </button>
    </div>
  );
}

function ActiveCalls({ calls, onOpen }) {
  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Active conversations
          <span className="count mono">{calls.length} LIVE</span>
        </div>
        <div className="panel__hdr-actions">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ops-fg-3)', letterSpacing: '.1em' }}>
            CHANNEL · ALL ▾
          </span>
        </div>
      </div>
      <div className="panel__body">
        <div className="calls">
          {calls.map(c => <CallCard key={c.id} call={c} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   LIVE FEED (bottom of center column)
   ===================================================== */
function ChannelGlyph({ channel }) {
  if (channel === 'voice') return <>◉ VOICE</>;
  if (channel === 'email') return <>✉ EMAIL</>;
  return <>▤ WEB</>;
}

function FeedRow({ item, isNew, onOpen }) {
  const dec = CS.DECISIONS.find(d => d.id === item.decision) || CS.DECISIONS[4];
  const time = CS.helpers.fmtTime(item.createdAt);
  // pick "current agent" based on stage
  const stageToAgent = { intake: 'intake', verify: 'shopify', rules: 'rules', draft: 'response', closed: '—' };
  const agentId = stageToAgent[item.stage] || 'intake';
  const agent = CS.AGENTS.find(a => a.id === agentId);

  return (
    <div className={`feed__row ${isNew ? 'is-new' : ''}`} onClick={() => onOpen && onOpen(item)}>
      <span className="feed__time mono">{time}</span>
      <span className={`feed__chan ${item.channel}`}><ChannelGlyph channel={item.channel} /></span>
      <span className="feed__cust">{item.customer.name} <em>· {item.order.product}</em></span>
      <span className="feed__id mono">{item.id}</span>
      <span className="feed__agent">
        {agent ? <><span className="glyph">{agent.glyph}</span> {agent.name}</> : <span style={{ color: 'var(--ops-fg-4)' }}>—</span>}
      </span>
      <span className={`feed__status ${dec.tone}`}>{dec.short}</span>
    </div>
  );
}

function LiveFeed({ feed, onOpen, newIds }) {
  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          Inbound activity
          <span className="count mono">LAST 60 MIN</span>
        </div>
        <div className="panel__hdr-actions">
          <span className="chip">VOICE · {feed.filter(f => f.channel==='voice').length}</span>
          <span className="chip">EMAIL · {feed.filter(f => f.channel==='email').length}</span>
          <span className="chip">WEB · {feed.filter(f => f.channel==='web').length}</span>
        </div>
      </div>
      <div className="panel__body">
        <div className="feed__hdr-row">
          <div>TIME</div><div>CHANNEL</div><div>CUSTOMER · PRODUCT</div><div>CASE ID</div><div>WITH AGENT</div><div>DECISION</div>
        </div>
        <div className="feed">
          {feed.map(item => (
            <FeedRow key={item.id} item={item} isNew={newIds.includes(item.id)} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ActiveCalls, LiveFeed });
