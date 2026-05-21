/* global React */
const { useState, useEffect, useRef, useMemo } = React;

/* =====================================================
   HEADER
   ===================================================== */
function Header({ pulseLabel, theme }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const logo = theme === 'light' ? 'assets/JOOLA_Lockup_Horizontal_Black.png' : 'assets/JOOLA_Lockup_Horizontal_White.svg';
  return (
    <header className="hdr">
      <div className="hdr__brand">
        <img src={logo} alt="JOOLA" />
        <div className="hdr__divider"></div>
        <div className="hdr__title">CS COMMAND<small>Warranty AI · Live</small></div>
      </div>
      <div className="hdr__center">
        <span className="live-pill"><span className="dot"></span> LIVE · {pulseLabel}</span>
        <span className="clock mono">
          {CS.helpers.pad(now.getHours())}:{CS.helpers.pad(now.getMinutes())}:{CS.helpers.pad(now.getSeconds())}
          <span>·</span>
          MON 17 MAY 2026
          <span>·</span>
          EST
        </span>
      </div>
      <div className="hdr__user">
        <button className="icon-btn" title="Filters">⌕</button>
        <button className="icon-btn" title="Notifications">⚐</button>
        <div className="user-tag">
          <div className="avatar">AL</div>
          <div className="meta"><b>Aisha Liu</b><span>CS LEAD</span></div>
        </div>
      </div>
    </header>
  );
}

/* =====================================================
   KPI STRIP
   ===================================================== */
function Spark({ data, color='var(--ops-yellow)' }) {
  const max = Math.max(...data, 1);
  const w = 60, h = 22;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i*step).toFixed(1)},${(h - (v/max)*h).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function KPI({ label, value, unit, delta, deltaDir, sparkData, accent, danger }) {
  let cls = 'kpi';
  if (accent) cls += ' kpi--accent';
  if (danger) cls += ' kpi--danger';
  return (
    <div className={cls}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta != null && (
        <div className={`kpi__delta ${deltaDir}`}>
          {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '◆'} {delta}
          <span style={{ color: 'var(--ops-fg-4)', marginLeft: 4 }}>vs avg</span>
        </div>
      )}
      {sparkData && <Spark data={sparkData} color={danger ? 'var(--ops-red)' : accent ? 'var(--ops-yellow)' : 'var(--ops-fg-3)'} />}
    </div>
  );
}

function KPIStrip({ kpi }) {
  // generate sparkline-ish series
  const sparks = useMemo(() => Array.from({length: 6}, () =>
    Array.from({length: 12}, () => Math.random() * 10 + 3)
  ), []);

  return (
    <div className="kpis">
      <KPI label="Calls today"      value={kpi.callsToday}  unit=""    delta="+18%"  deltaDir="up"   sparkData={sparks[0]} />
      <KPI label="Emails today"     value={kpi.emailsToday} unit=""    delta="+6%"   deltaDir="up"   sparkData={sparks[1]} />
      <KPI label="Web forms"        value={kpi.webForms}    unit=""    delta="−4%"   deltaDir="down" sparkData={sparks[2]} />
      <KPI label="Open claims"      value={kpi.openClaims}  unit=""    delta="+3"    deltaDir="flat" sparkData={sparks[3]} accent />
      <KPI label="Auto-resolved"    value={kpi.autoResolve} unit="%"   delta="+2.1"  deltaDir="up"   sparkData={sparks[4]} />
      <KPI label="Avg handle"       value={`${Math.floor(kpi.avgHandle/60)}:${CS.helpers.pad(kpi.avgHandle%60)}`} delta="−12s" deltaDir="up" sparkData={sparks[5]} />
      <KPI label="Escalations"      value={kpi.escalations} unit=""    delta={`${kpi.slaBreach} SLA breach`}    deltaDir="down" danger />
    </div>
  );
}

/* =====================================================
   AGENT TEAM (left)
   ===================================================== */
function AgentRow({ agent, onClick, selected }) {
  const stateLabel = { idle: 'IDLE', busy: 'PROCESSING', blocked: 'BLOCKED', error: 'ERROR' }[agent.state];
  return (
    <div className={`agent is-${agent.state} ${selected ? 'is-selected' : ''}`} onClick={onClick}>
      <div className="agent__top">
        <div className="agent__name">
          <span className="glyph">{agent.glyph}</span>
          {agent.name}
        </div>
        <div className="agent__status">
          <span className="status-dot"></span>{stateLabel}
        </div>
      </div>
      <div className="agent__meta">
        <span>Queue <b>{agent.queue}</b></span>
        <span>Handled <b>{agent.handled}</b></span>
        <span>Avg <b>{agent.avgMs}ms</b></span>
        <span>Load <b>{agent.load}%</b></span>
      </div>
      <div className="agent__bar"><i style={{ width: `${agent.load}%` }}></i></div>
      <div className="agent__task">
        {agent.state === 'idle'
          ? <span style={{ color: 'var(--ops-fg-4)' }}>Awaiting work…</span>
          : <span>On <code>{agent.currentTaskFor}</code> · {agent.role}</span>
        }
      </div>
    </div>
  );
}

function AgentTeam({ agents, onSelect, selectedId }) {
  const busy = agents.filter(a => a.state === 'busy').length;
  return (
    <div className="panel">
      <div className="panel__hdr">
        <div className="panel__title">
          AI Agent Team
          <span className="count mono">{busy}/{agents.length} ACTIVE</span>
        </div>
        <div className="panel__hdr-actions">
          <button className="icon-btn" title="Refresh">↻</button>
        </div>
      </div>
      <div className="panel__body">
        <div className="agent-list">
          {agents.map(a => (
            <AgentRow key={a.id} agent={a} selected={a.id === selectedId} onClick={() => onSelect(a)} />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Header, KPIStrip, AgentTeam, Spark });
