/* global React, ReactDOM, CS */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "simSpeed": 1,
  "showVolume": true,
  "density": "comfortable",
  "accent": "#F5E625"
}/*EDITMODE-END*/;

/* ============================================================
   TAB STRIP
   ============================================================ */
function TabStrip({ view, setView, liveBadge, archiveBadge }) {
  return (
    <div className="tabs" role="tablist">
      <button
        role="tab"
        className={`tab ${view === 'live' ? 'is-active' : ''}`}
        onClick={() => setView('live')}
      >
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                       background: view === 'live' ? 'var(--ops-yellow)' : 'var(--ops-fg-3)',
                       boxShadow: view === 'live' ? '0 0 0 3px rgba(245,230,37,0.2)' : 'none' }} />
        Live operations
        <span className="badge">{liveBadge}</span>
      </button>
      <button
        role="tab"
        className={`tab ${view === 'archive' ? 'is-active' : ''}`}
        onClick={() => setView('archive')}
      >
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                       background: view === 'archive' ? 'var(--ops-yellow)' : 'var(--ops-fg-3)' }} />
        Archive · Reports
        <span className="badge">{archiveBadge}</span>
      </button>

      <span className="tab-spacer"></span>

      <span className="tab-meta">
        {view === 'live'
          ? <>REAL-TIME · AUTO-REFRESH · POLL EVERY ~2s</>
          : <>HISTORICAL · READ-ONLY · POINT-IN-TIME SNAPSHOT</>}
      </span>
    </div>
  );
}

/* ============================================================
   LIVE VIEW — extracted from previous App body
   ============================================================ */
function LiveView({
  kpi, agents, activeCalls, feed, pipeline, escalations, volume,
  newIds, selectedAgent, setSelectedAgent,
  showVolume, openClaim, openCall,
}) {
  return (
    <div className="view-live">
      <KPIStrip kpi={kpi} />
      <div className="main">
        <div className="col">
          <AgentTeam agents={agents} onSelect={setSelectedAgent} selectedId={selectedAgent?.id} />
          {showVolume && (
            <div className="minicharts" style={{ borderTop: '1px solid var(--ops-line)', background: 'var(--ops-panel)' }}>
              <VolumeChart samples={volume} />
            </div>
          )}
        </div>
        <div className="col center">
          <ActiveCalls calls={activeCalls} onOpen={openCall} />
          <LiveFeed feed={feed} onOpen={openClaim} newIds={newIds} />
        </div>
        <div className="col right">
          <Pipeline stages={pipeline} />
          <Escalations items={escalations} onClaim={openClaim} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // theme
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.style.setProperty('--ops-yellow', t.accent || '#F5E625');
  }, [t.theme, t.accent]);

  // view
  const [view, setView] = React.useState('live');

  // live state
  const [kpi, setKpi]                     = React.useState(CS.seedKPI);
  const [agents, setAgents]               = React.useState(CS.seedAgents);
  const [activeCalls, setActiveCalls]     = React.useState(CS.seedActiveCalls);
  const [feed, setFeed]                   = React.useState(CS.seedFeed);
  const [pipeline, setPipeline]           = React.useState(CS.seedPipeline);
  const [escalations, setEscalations]     = React.useState(CS.seedEscalations);
  const [volume, setVolume]               = React.useState(CS.seedVolume);
  const [newIds, setNewIds]               = React.useState([]);
  const [selectedAgent, setSelectedAgent] = React.useState(null);

  // archive state
  const [tickets, setTickets]             = React.useState(() => CS.seedArchive(280));

  // drawer
  const [drawerClaim, setDrawerClaim]     = React.useState(null);
  const [drawerOpen, setDrawerOpen]       = React.useState(false);

  /* --- live simulation tick (only when on live view) --- */
  React.useEffect(() => {
    if (view !== 'live') return;
    const interval = Math.max(800, 2200 / (t.simSpeed || 1));
    const tick = setInterval(() => {
      setActiveCalls(prev => prev.map(c => {
        if (c.transcriptIdx < c.transcript.length - 1 && Math.random() < 0.55) {
          return { ...c, transcriptIdx: c.transcriptIdx + 1 };
        }
        return c;
      }));

      setAgents(prev => prev.map(a => {
        const r = Math.random();
        let s = { ...a };
        if (r < 0.18) {
          const order = ['idle','busy','busy','busy','blocked'];
          const next = order[Math.floor(Math.random() * order.length)];
          s.state = next;
          if (next === 'idle') { s.load = 0; s.currentTaskFor = null; }
          else if (next === 'busy') {
            s.load = CS.helpers.randInt(35, 95);
            s.currentTaskFor = `WC-${10000 + CS.helpers.randInt(1, 900)}`;
          } else if (next === 'blocked') {
            s.load = CS.helpers.randInt(20, 50);
          }
        } else if (a.state === 'busy') {
          s.load = Math.max(15, Math.min(98, a.load + CS.helpers.randInt(-8, 12)));
          if (Math.random() < 0.4) s.handled = a.handled + 1;
        }
        s.queue = Math.max(0, a.queue + CS.helpers.randInt(-1, 1));
        return s;
      }));

      setKpi(prev => {
        const next = { ...prev };
        if (Math.random() < 0.25) next.callsToday = prev.callsToday + 1;
        if (Math.random() < 0.35) next.emailsToday = prev.emailsToday + 1;
        if (Math.random() < 0.08) next.webForms = prev.webForms + 1;
        if (Math.random() < 0.1)  next.openClaims = Math.max(0, prev.openClaims + CS.helpers.randInt(-1, 1));
        return next;
      });

      if (Math.random() < 0.4) {
        const c = CS.buildClaim();
        c.createdAt = new Date();
        setFeed(prev => [c, ...prev].slice(0, 40));
        setNewIds(prev => [c.id, ...prev].slice(0, 6));
        setTimeout(() => setNewIds(prev => prev.filter(id => id !== c.id)), 5000);
      }

      setVolume(prev => {
        const next = prev.slice();
        next[next.length - 1] = Math.max(2, next[next.length - 1] + CS.helpers.randInt(-1, 2));
        return next;
      });

      setPipeline(prev => prev.map((s, i) => {
        if (i === 4) return Math.random() < 0.2 ? { ...s, count: s.count + 1 } : s;
        const d = CS.helpers.randInt(-1, 1);
        return { ...s, count: Math.max(0, s.count + d) };
      }));
    }, interval);
    return () => clearInterval(tick);
  }, [t.simSpeed, view]);

  /* --- actions --- */
  const openClaim = (claimLike) => {
    let claim = claimLike;
    if (!claim.issue) claim = { ...claim, issue: 'Paddle damage reported by customer during play.' };
    if (!claim.decision) claim.decision = 'PROCESSING';
    setDrawerClaim(claim);
    setDrawerOpen(true);
  };

  const openCall = (call) => {
    openClaim({
      id: call.id.replace('CALL-', 'WC-'),
      customer: call.customer,
      order: call.order,
      registration: call.registration,
      issue: call.transcript[0].txt,
      channel: call.channel,
      stage: call.stage,
      decision: call.decisionPreview,
    });
  };

  const closeDrawer = () => setDrawerOpen(false);

  // Reopen archived ticket → push into live feed, mark reopened in archive, switch view
  const reopenToLive = (ticket) => {
    // Push into live feed as a fresh inquiry
    const liveCopy = {
      id: ticket.id,
      customer: ticket.customer,
      order: ticket.order,
      registration: ticket.registration,
      issue: ticket.issue,
      channel: ticket.channel,
      stage: 'intake',
      decision: 'PROCESSING',
      sentiment: 0.5,
      createdAt: new Date(),
    };
    setFeed(prev => [liveCopy, ...prev.filter(f => f.id !== ticket.id)].slice(0, 40));
    setNewIds(prev => [ticket.id, ...prev].slice(0, 6));
    setTimeout(() => setNewIds(prev => prev.filter(id => id !== ticket.id)), 6000);

    // Mark in archive as REOPENED (keep it visible there too)
    setTickets(prev => prev.map(t => t.id === ticket.id
      ? { ...t, status: 'REOPENED', stage: 'intake' }
      : t
    ));

    // Bump open claims KPI
    setKpi(prev => ({ ...prev, openClaims: prev.openClaims + 1 }));

    // Switch to live view so user sees the result
    setView('live');
    closeDrawer();
  };

  const openCaseFromArchive = (t) => {
    openClaim({
      id: t.id,
      customer: t.customer,
      order: t.order,
      registration: t.registration,
      issue: t.issue,
      channel: t.channel,
      stage: t.stage,
      decision: t.decision,
      _archived: t,
    });
  };

  const liveBadge = `${kpi.openClaims} OPEN`;
  const archiveBadge = `${tickets.length}`;

  const appCls = `app app--${view}`;

  return (
    <div className={appCls}>
      <Header
        pulseLabel={view === 'live' ? `${activeCalls.length} ACTIVE CALLS` : 'HISTORICAL VIEW'}
        theme={t.theme}
      />
      <TabStrip view={view} setView={setView} liveBadge={liveBadge} archiveBadge={archiveBadge} />

      {view === 'live' ? (
        <LiveView
          kpi={kpi} agents={agents} activeCalls={activeCalls} feed={feed}
          pipeline={pipeline} escalations={escalations} volume={volume}
          newIds={newIds} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
          showVolume={t.showVolume}
          openClaim={openClaim} openCall={openCall}
        />
      ) : (
        <ArchiveView
          tickets={tickets}
          setTickets={setTickets}
          onOpenCase={openCaseFromArchive}
          onReopenToLive={reopenToLive}
        />
      )}

      <CaseDrawer
        claim={drawerClaim}
        open={drawerOpen}
        onClose={closeDrawer}
        archived={drawerClaim && drawerClaim._archived}
        onReopen={drawerClaim && drawerClaim._archived ? () => reopenToLive(drawerClaim._archived) : null}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} options={[
            { value: 'dark', label: 'Dark ops' },
            { value: 'light', label: 'Light' },
          ]} onChange={(v) => setTweak('theme', v)} />
          <TweakColor label="Accent" value={t.accent} options={[
            '#F5E625', '#FF8A1F', '#34C77B', '#4E9DFF', '#D6182A',
          ]} onChange={(v) => setTweak('accent', v)} />
        </TweakSection>

        <TweakSection label="Live simulation">
          <TweakSlider label="Tick speed" value={t.simSpeed} min={0.3} max={3} step={0.1} unit="×"
            onChange={(v) => setTweak('simSpeed', v)} />
          <TweakToggle label="24h volume chart" value={t.showVolume} onChange={(v) => setTweak('showVolume', v)} />
        </TweakSection>

        <TweakSection label="Quick actions">
          <TweakButton label="Inject new call" onClick={() => {
            const claim = CS.buildClaim({ channel: 'voice', stage: 'intake' });
            claim.createdAt = new Date();
            setFeed(prev => [claim, ...prev].slice(0, 40));
            setNewIds(prev => [claim.id, ...prev].slice(0, 6));
            setTimeout(() => setNewIds(prev => prev.filter(id => id !== claim.id)), 5000);
            setKpi(prev => ({ ...prev, callsToday: prev.callsToday + 1 }));
            setView('live');
          }} />
          <TweakButton label="Trigger escalation" onClick={() => {
            const claim = CS.buildClaim({ decision: 'HUMAN_REVIEW_REQUIRED' });
            setEscalations(prev => [{
              id: claim.id,
              cust: claim.customer.name,
              summary: 'New escalation: ambiguous damage on ' + claim.order.product + '. AI requested human judgment.',
              reason: 'AMBIGUOUS_DAMAGE',
              priority: 'high',
              waitMin: 1,
            }, ...prev].slice(0, 8));
            setView('live');
          }} />
          <TweakButton label="Regenerate archive (280 tix)" onClick={() => setTickets(CS.seedArchive(280))} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
