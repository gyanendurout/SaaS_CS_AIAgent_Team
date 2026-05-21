# JOOLA CS Command — Warranty AI Dashboard

A live operations dashboard for a CS Lead overseeing a 7-agent AI team
that handles warranty claims via phone, email, and web form.

## What's inside this folder

```
design/
├── CS Command Dashboard (standalone).html   ← double-click this to open offline
├── CS Command Dashboard.html                ← source HTML (loads /src and /assets)
├── styles.css
├── src/
│   ├── App.jsx           main React app + state + simulation loop
│   ├── Header.jsx        header bar, KPI strip, agent team panel
│   ├── Center.jsx        active calls + live activity feed
│   ├── Right.jsx         claim pipeline + decision mix + escalations + volume chart
│   ├── CaseDrawer.jsx    slide-in case detail (drawer)
│   ├── data.js           mock data + live simulation seeds
│   └── tweaks-panel.jsx  floating Tweaks shell
└── assets/
    ├── colors_and_type.css   JOOLA design tokens (colors, type, spacing, motion)
    ├── JOOLA_Lockup_Horizontal_White.svg
    ├── JOOLA_Lockup_Horizontal_Black.png
    └── JOOLA_Trinity_Yellow.png
```

## How to open it

**Easiest — no setup:**
Open `CS Command Dashboard (standalone).html` in any modern browser.
It's a single self-contained file with everything inlined.

**Developing / editing:**
Open `CS Command Dashboard.html` via a local web server (the JSX files
need to be fetched over http, not file://). Quickest options:

```bash
# Python 3
python -m http.server 8080
# Node
npx serve .
```

Then go to http://localhost:8080/CS%20Command%20Dashboard.html

## What it shows

The dashboard has **two tabs** in the strip under the header:

### 🟡 LIVE OPERATIONS
- **Header** — live pulse indicator, real-time clock, CS Lead identity
- **7 KPIs** — calls, emails, web forms, open claims, auto-resolve %, avg handle, escalations + SLA breach
- **Agent team (left)** — all 7 AI agents (Intake → Shopify Verify → Warranty Reg → Rule Engine → Claim Summary → Customer Reply → Human Escalation) with state, queue depth, load, and current case
- **Active conversations (center top)** — live call cards with animated waveforms, streaming transcripts, sentiment bars
- **Inbound activity feed (center bottom)** — rolling list of every voice/email/web inquiry coming in
- **Claim pipeline (right top)** — 5-stage funnel with stuck-claim alerts + decision mix
- **Human escalations (right bottom)** — priority-tagged queue with one-click claim

### 📦 ARCHIVE · REPORTS
- **7 historical KPIs** — tickets in range, closed, open, reopened, eligible %, auto-resolved %, avg handle
- **Filter bar** — search (customer · email · issue · WC-id), date range, channel, decision, primary agent + status chips (Open / Closed / Reopened) and flag toggles (SLA breach · Escalated · Unauthorized seller)
- **Ticket table** — paginated, sortable, with status pills, decision pills, handle time, resolved time
- **Side analytics** — daily volume bars, decision donut, agent leaderboard, channel mix, top-issues bar list
- **Reopen → Live** — any closed ticket can be sent back into the Live feed with one click; status flips to `REOPENED` in archive, view auto-switches to Live so you can watch the agents pick it up again

### Case drawer (both tabs)
Click any feed row, escalation, call, or archive ticket to see:
- The customer's issue quote
- The deterministic rule-engine decision
- Full purchase + registration verification
- The **7-agent journey timeline** with each agent's input/output
- AI-drafted email + voice reply ready for approval
- (Archive only) `REOPEN → LIVE` button in the drawer header

## Tweaks

Toggle the Tweaks panel (toolbar) to:
- Switch dark ↔ light theme
- Change accent color
- Scrub live simulation speed (0.3×–3×)
- Show/hide the 24h volume chart
- Inject a new call or escalation on demand
- Regenerate the 280-ticket archive
