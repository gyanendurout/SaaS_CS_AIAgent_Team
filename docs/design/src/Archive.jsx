/* global React, CS */

/* ============================================================
   ARCHIVE / REPORTS VIEW
   Filterable historical tickets with side analytics.
   ============================================================ */

const PAGE_SIZE = 18;

function ArchiveKPIs({ filtered, all }) {
  const total = filtered.length;
  const closed = filtered.filter(t => t.status === 'CLOSED').length;
  const open = filtered.filter(t => t.status === 'OPEN').length;
  const reopened = filtered.filter(t => t.status === 'REOPENED').length;
  const eligible = filtered.filter(t => t.decision === 'ELIGIBLE_FOR_DAMAGE_REVIEW').length;
  const auto = filtered.filter(t => !t.assignedAgent).length;
  const autoPct = total ? Math.round((auto / total) * 100) : 0;
  const avgHandle = (() => {
    const closedT = filtered.filter(t => t.status === 'CLOSED' && t.handleSec);
    if (!closedT.length) return 0;
    return Math.round(closedT.reduce((a,b) => a + b.handleSec, 0) / closedT.length);
  })();
  const eligPct = total ? Math.round((eligible / total) * 100) : 0;
  const resPct = total ? Math.round((closed / total) * 100) : 0;

  return (
    <div className="kpis kpis--archive">
      <div className="kpi">
        <div className="kpi__label">Tickets in range</div>
        <div className="kpi__value"><span className="num">{total.toLocaleString()}</span></div>
        <div className="kpi__delta flat">of {all.length} total</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Closed</div>
        <div className="kpi__value"><span className="num">{closed.toLocaleString()}</span><span className="unit">{resPct}%</span></div>
        <div className="kpi__delta up">▲ resolution rate</div>
      </div>
      <div className="kpi kpi--accent">
        <div className="kpi__label">Open</div>
        <div className="kpi__value"><span className="num">{open}</span></div>
        <div className="kpi__delta flat">in progress</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Reopened</div>
        <div className="kpi__value"><span className="num">{reopened}</span></div>
        <div className="kpi__delta flat">customer follow-ups</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Eligible</div>
        <div className="kpi__value"><span className="num">{eligPct}</span><span className="unit">%</span></div>
        <div className="kpi__delta up">damage review · {eligible}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Auto-resolved</div>
        <div className="kpi__value"><span className="num">{autoPct}</span><span className="unit">%</span></div>
        <div className="kpi__delta up">no human touch</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Avg handle</div>
        <div className="kpi__value"><span className="num">{CS.fmtDuration(avgHandle)}</span></div>
        <div className="kpi__delta up">closed tickets</div>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters, agentList }) {
  const upd = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  return (
    <div className="filterbar">
      <div className="filter filter--search">
        <label>Search</label>
        <input
          placeholder="customer · email · issue · WC-id…"
          value={filters.q}
          onChange={(e) => upd('q', e.target.value)}
        />
      </div>
      <div className="filter">
        <label>Date range</label>
        <select value={filters.range} onChange={(e) => upd('range', e.target.value)}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div className="filter">
        <label>Channel</label>
        <select value={filters.channel} onChange={(e) => upd('channel', e.target.value)}>
          <option value="">All channels</option>
          <option value="voice">Voice</option>
          <option value="email">Email</option>
          <option value="web">Web form</option>
        </select>
      </div>
      <div className="filter">
        <label>Decision</label>
        <select value={filters.decision} onChange={(e) => upd('decision', e.target.value)}>
          <option value="">All decisions</option>
          <option value="ELIGIBLE_FOR_DAMAGE_REVIEW">Eligible</option>
          <option value="NOT_ELIGIBLE">Not eligible</option>
          <option value="HUMAN_REVIEW_REQUIRED">Human review</option>
          <option value="WARRANTY_EXPIRED">Warranty expired</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </div>
      <div className="filter">
        <label>Primary agent</label>
        <select value={filters.agent} onChange={(e) => upd('agent', e.target.value)}>
          <option value="">All agents</option>
          {agentList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="filter--actions">
        <button onClick={() => setFilters({ q: '', range: '30', channel: '', decision: '', agent: '', status: '' })}>RESET</button>
        <button className="primary">EXPORT CSV ⇣</button>
      </div>
    </div>
  );
}

function StatusChips({ filters, setFilters, counts }) {
  return (
    <div className="chips">
      <div className="chips__group">
        <button className={`chipbtn ${filters.status === '' ? 'is-on' : ''}`}    onClick={() => setFilters(f => ({ ...f, status: '' }))}>ALL · {counts.all}</button>
        <button className={`chipbtn ${filters.status === 'OPEN' ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, status: 'OPEN' }))}>OPEN · {counts.open}</button>
        <button className={`chipbtn ${filters.status === 'CLOSED' ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, status: 'CLOSED' }))}>CLOSED · {counts.closed}</button>
        <button className={`chipbtn ${filters.status === 'REOPENED' ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, status: 'REOPENED' }))}>REOPENED · {counts.reopened}</button>
      </div>
      <div className="chips__group">
        <button className={`chipbtn ${filters.flagSLA ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, flagSLA: !f.flagSLA }))}>SLA BREACH</button>
        <button className={`chipbtn ${filters.flagEsc ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, flagEsc: !f.flagEsc }))}>ESCALATED</button>
        <button className={`chipbtn ${filters.flagUnauth ? 'is-on' : ''}`} onClick={() => setFilters(f => ({ ...f, flagUnauth: !f.flagUnauth }))}>UNAUTHORIZED SELLER</button>
      </div>
    </div>
  );
}

function ArchiveTable({ rows, page, setPage, onOpen, onReopen }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const decClass = (d) => ({
    ELIGIBLE_FOR_DAMAGE_REVIEW: 'eligible',
    NOT_ELIGIBLE: 'not-eligible',
    HUMAN_REVIEW_REQUIRED: 'review',
    WARRANTY_EXPIRED: 'expired',
    PROCESSING: 'processing',
  }[d]);
  const decShort = (d) => ({
    ELIGIBLE_FOR_DAMAGE_REVIEW: 'ELIGIBLE',
    NOT_ELIGIBLE: 'NOT ELIG',
    HUMAN_REVIEW_REQUIRED: 'HUMAN',
    WARRANTY_EXPIRED: 'EXPIRED',
    PROCESSING: 'PROCESSING',
  }[d]);

  return (
    <>
      <div className="tbl-wrap">
        {pageRows.length === 0 ? (
          <div className="empty">
            <div className="big">No tickets match</div>
            Try widening the date range or clearing filters.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 110 }}>OPENED</th>
                <th style={{ width: 84 }}>CHANNEL</th>
                <th style={{ width: 92 }}>ID</th>
                <th>CUSTOMER · PRODUCT</th>
                <th style={{ width: 140 }}>ISSUE</th>
                <th style={{ width: 120 }}>DECISION</th>
                <th style={{ width: 90 }}>STATUS</th>
                <th style={{ width: 110 }}>RESOLVED</th>
                <th style={{ width: 90 }}>HANDLE</th>
                <th style={{ width: 130 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(t => (
                <tr key={t.id} onClick={() => onOpen(t)}>
                  <td className="mono">{CS.fmtDateTime(t.createdAt)}</td>
                  <td><span className={`feed__chan ${t.channel}`} style={{ fontSize: 10 }}>
                    {t.channel === 'voice' ? '◉' : t.channel === 'email' ? '✉' : '▤'} {t.channel.toUpperCase()}
                  </span></td>
                  <td className="mono" style={{ color: 'var(--ops-fg)' }}>{t.id}</td>
                  <td>
                    {t.customer.name}
                    <span className="secondary">{t.order.product} · <span className="mono">{t.order.number}</span></span>
                  </td>
                  <td><span style={{ fontSize: 11, color: 'var(--ops-fg-2)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issue}</span></td>
                  <td><span className={`decision-pill ${decClass(t.decision)}`}>{decShort(t.decision)}</span></td>
                  <td><span className={`status-pill ${t.status.toLowerCase()}`}>{t.status}</span></td>
                  <td className="mono"><span style={{ color: t.closedAt ? 'var(--ops-fg)' : 'var(--ops-fg-4)' }}>{CS.fmtDateTime(t.closedAt)}</span></td>
                  <td className="mono">{CS.fmtDuration(t.handleSec)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {t.status === 'CLOSED' ? (
                      <button className="tbl-action-btn" onClick={() => onReopen(t)}>REOPEN →</button>
                    ) : t.status === 'OPEN' ? (
                      <button className="tbl-action-btn" onClick={() => onReopen(t)}>SEND LIVE →</button>
                    ) : (
                      <button className="tbl-action-btn muted">VIEW</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      <div className="pagi">
        <div>SHOWING {rows.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} OF <b style={{ color: 'var(--ops-fg)' }}>{rows.length}</b></div>
        <div className="pagi__nav">
          <button disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 3, totalPages - 7));
            const n = start + i;
            if (n >= totalPages) return null;
            return <button key={n} className={n === page ? 'is-current' : ''} onClick={() => setPage(n)}>{n + 1}</button>;
          })}
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        </div>
      </div>
    </>
  );
}

/* ----- Side analytics ----- */

function DailyVolume({ rows, days }) {
  const buckets = React.useMemo(() => {
    const n = days === 'all' ? 30 : Number(days);
    const arr = Array.from({ length: n }, () => 0);
    const now = Date.now();
    rows.forEach(t => {
      const offset = Math.floor((now - t.createdAt.getTime()) / 86400000);
      if (offset >= 0 && offset < n) arr[n - 1 - offset]++;
    });
    return arr;
  }, [rows, days]);
  const max = Math.max(...buckets, 1);
  return (
    <div className="ar-block">
      <h4>Daily volume <span className="meta">{buckets.reduce((a,b)=>a+b,0)} TIX</span></h4>
      <div className="dailybars">
        {buckets.map((v, i) => (
          <i key={i}
             className={i === buckets.length - 1 ? 'peak' : ''}
             style={{ height: `${(v / max) * 100}%` }}
             title={`${v} tickets`} />
        ))}
      </div>
      <div className="dailybars-labels">
        <span>{buckets.length}d ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function AgentLeaderboard({ rows }) {
  const data = React.useMemo(() => {
    const map = {};
    CS.AGENTS.forEach(a => { map[a.id] = { ...a, count: 0 }; });
    rows.forEach(t => { if (map[t.primaryAgent]) map[t.primaryAgent].count++; });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [rows]);
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="ar-block">
      <h4>By primary agent <span className="meta">FINALIZED</span></h4>
      <div>
        {data.map((d, i) => (
          <div key={d.id} className="leader">
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="name"><span className="glyph">{d.glyph}</span>{d.name}</span>
            <span className="num">{d.count}</span>
            <div className="bar"><i style={{ width: `${(d.count / max) * 100}%` }}></i></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionDonut({ rows }) {
  const data = React.useMemo(() => {
    const counts = { ELIGIBLE_FOR_DAMAGE_REVIEW: 0, NOT_ELIGIBLE: 0, HUMAN_REVIEW_REQUIRED: 0, WARRANTY_EXPIRED: 0, PROCESSING: 0 };
    rows.forEach(t => { counts[t.decision]++; });
    return counts;
  }, [rows]);
  const total = rows.length || 1;
  const colors = {
    ELIGIBLE_FOR_DAMAGE_REVIEW: 'var(--ops-green)',
    NOT_ELIGIBLE: 'var(--ops-red)',
    HUMAN_REVIEW_REQUIRED: 'var(--ops-orange)',
    WARRANTY_EXPIRED: 'var(--ops-fg-3)',
    PROCESSING: 'var(--ops-yellow)',
  };
  const labels = {
    ELIGIBLE_FOR_DAMAGE_REVIEW: 'Eligible',
    NOT_ELIGIBLE: 'Not eligible',
    HUMAN_REVIEW_REQUIRED: 'Human review',
    WARRANTY_EXPIRED: 'Expired',
    PROCESSING: 'Processing',
  };
  const order = ['ELIGIBLE_FOR_DAMAGE_REVIEW', 'HUMAN_REVIEW_REQUIRED', 'NOT_ELIGIBLE', 'WARRANTY_EXPIRED', 'PROCESSING'];
  const r = 36, c = 50;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ar-block">
      <h4>Decision mix <span className="meta">RULE ENGINE</span></h4>
      <div className="donut-wrap">
        <svg viewBox="0 0 100 100">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ops-panel-3)" strokeWidth="14" />
          {order.map(k => {
            const portion = data[k] / total;
            if (portion === 0) return null;
            const len = portion * circ;
            const dash = `${len} ${circ - len}`;
            const arc = <circle
              key={k}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={colors[k]}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />;
            offset += len;
            return arc;
          })}
        </svg>
        <div className="donut-legend">
          {order.map(k => (
            <div key={k} className="row">
              <span className="sw" style={{ background: colors[k] }}></span>
              <span className="lbl">{labels[k]}</span>
              <span className="val">{data[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopIssues({ rows }) {
  const data = React.useMemo(() => {
    const map = {};
    rows.forEach(t => { map[t.issue] = (map[t.issue] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);
  const max = Math.max(...data.map(d => d[1]), 1);
  return (
    <div className="ar-block">
      <h4>Top issues <span className="meta">{rows.length} TIX</span></h4>
      <div className="toplist">
        {data.map(([issue, count]) => (
          <div className="topitem" key={issue}>
            <span className="lbl" title={issue}>{issue}</span>
            <span className="val">{count}</span>
            <div className="bar"><i style={{ width: `${(count / max) * 100}%` }}></i></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelMix({ rows }) {
  const data = React.useMemo(() => {
    const counts = { voice: 0, email: 0, web: 0 };
    rows.forEach(t => { counts[t.channel]++; });
    return counts;
  }, [rows]);
  const total = rows.length || 1;
  return (
    <div className="ar-block">
      <h4>Channel mix <span className="meta">{total} TIX</span></h4>
      {[
        { id: 'voice', label: 'Voice', color: 'var(--ops-yellow)' },
        { id: 'email', label: 'Email', color: 'var(--ops-blue)' },
        { id: 'web',   label: 'Web form', color: 'var(--ops-purple)' },
      ].map(c => {
        const pct = Math.round((data[c.id] / total) * 100);
        return (
          <div className="topitem" key={c.id}>
            <span className="lbl">{c.label}</span>
            <span className="val">{data[c.id]} · {pct}%</span>
            <div className="bar"><i style={{ width: `${pct}%`, background: c.color }}></i></div>
          </div>
        );
      })}
    </div>
  );
}

/* ----- Filter logic ----- */
function applyFilters(all, filters) {
  let r = all;
  const q = (filters.q || '').toLowerCase().trim();
  if (q) {
    r = r.filter(t =>
      t.customer.name.toLowerCase().includes(q) ||
      t.customer.email.toLowerCase().includes(q) ||
      t.issue.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.order.number.toLowerCase().includes(q) ||
      t.order.product.toLowerCase().includes(q)
    );
  }
  if (filters.range && filters.range !== 'all') {
    const days = Number(filters.range);
    const cutoff = Date.now() - days * 86400000;
    r = r.filter(t => t.createdAt.getTime() >= cutoff);
  }
  if (filters.channel)  r = r.filter(t => t.channel === filters.channel);
  if (filters.decision) r = r.filter(t => t.decision === filters.decision);
  if (filters.agent)    r = r.filter(t => t.primaryAgent === filters.agent);
  if (filters.status)   r = r.filter(t => t.status === filters.status);
  if (filters.flagEsc)  r = r.filter(t => t.decision === 'HUMAN_REVIEW_REQUIRED');
  if (filters.flagUnauth) r = r.filter(t => !t.order.authorized);
  if (filters.flagSLA)  r = r.filter(t => t.handleSec > 600);
  return r;
}

/* ----- Top-level ArchiveView ----- */
function ArchiveView({ tickets, setTickets, onOpenCase, onReopenToLive }) {
  const [filters, setFilters] = React.useState({
    q: '', range: '30', channel: '', decision: '', agent: '', status: '',
    flagSLA: false, flagEsc: false, flagUnauth: false,
  });
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => applyFilters(tickets, filters), [tickets, filters]);
  React.useEffect(() => { setPage(0); }, [filters]);

  const counts = React.useMemo(() => {
    // counts ignoring status filter, for the chip row
    const base = applyFilters(tickets, { ...filters, status: '' });
    return {
      all: base.length,
      open: base.filter(t => t.status === 'OPEN').length,
      closed: base.filter(t => t.status === 'CLOSED').length,
      reopened: base.filter(t => t.status === 'REOPENED').length,
    };
  }, [tickets, filters]);

  return (
    <div className="view-archive">
      <ArchiveKPIs filtered={filtered} all={tickets} />
      <FilterBar filters={filters} setFilters={setFilters} agentList={CS.AGENTS} />
      <div className="archive">
        <div className="ar-main">
          <StatusChips filters={filters} setFilters={setFilters} counts={counts} />
          <div className="results-meta">
            <span><b>{filtered.length}</b> tickets · sorted by newest</span>
            <span>Range · last {filters.range === 'all' ? '∞' : filters.range + 'd'} · Page <b>{page + 1}</b> / {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}</span>
          </div>
          <ArchiveTable rows={filtered} page={page} setPage={setPage} onOpen={onOpenCase} onReopen={onReopenToLive} />
        </div>
        <aside className="ar-side">
          <DailyVolume rows={filtered} days={filters.range} />
          <DecisionDonut rows={filtered} />
          <AgentLeaderboard rows={filtered} />
          <ChannelMix rows={filtered} />
          <TopIssues rows={filtered} />
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { ArchiveView });
