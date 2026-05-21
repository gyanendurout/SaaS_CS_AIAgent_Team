-- =============================================================================
-- JOOLA AI CS Warranty Management System
-- Migration 0001: Initial Schema
-- Created: 2026-05-17
-- Policy version anchored: 1.0.0
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Idempotent: safe to re-run (uses IF NOT EXISTS where possible).
-- Single transaction: rolls back cleanly on any error.
-- =============================================================================

begin;

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- GIN trigram search for archive

-- =============================================================================
-- 2. ENUMS
-- =============================================================================

do $$ begin
  create type channel_type as enum ('voice', 'email', 'web');
exception when duplicate_object then null; end $$;

do $$ begin
  create type decision_type as enum (
    'PROCESSING',
    'ELIGIBLE_FOR_DAMAGE_REVIEW',
    'NOT_ELIGIBLE',
    'HUMAN_REVIEW_REQUIRED',
    'WARRANTY_EXPIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status_detail as enum (
    'NEW',
    'AWAITING_VERIFICATION',
    'IN_RULE_EVAL',
    'AWAITING_PHOTOS',
    'AWAITING_RECEIPT',
    'DRAFT_PENDING_APPROVAL',
    'DRAFT_APPROVED',
    'AWAITING_CUSTOMER_REPLY',
    'AWAITING_DAMAGE_REVIEW',
    'VOID_AND_BREAK_PENDING',
    'VOID_AND_BREAK_COMPLETED',
    'REPLACEMENT_APPROVED',
    'REPLACEMENT_SHIPPED',
    'REPLACEMENT_DELIVERED',
    'ESCALATED',
    'ON_HOLD',
    'CLOSED_RESOLVED',
    'CLOSED_DECLINED',
    'CLOSED_EXPIRED',
    'CLOSED_NO_RESPONSE',
    'REOPENED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type display_status_type as enum ('OPEN', 'CLOSED', 'REOPENED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type agent_state_type as enum ('idle', 'busy', 'blocked', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escalation_priority as enum ('urgent', 'high', 'norm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escalation_reason as enum (
    'REPLACEMENT_LIMIT_REACHED',
    'OUTSIDE_REGION',
    'DISPUTED_SELLER',
    'AMBIGUOUS_DAMAGE',
    'BRAND_RISK',
    'SAFETY'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reopen_category as enum (
    'customer_disputed',
    'damage_worsened',
    'new_info',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type actor_type_enum as enum ('AI', 'CS_LEAD', 'CUSTOMER', 'SYSTEM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_source as enum (
    'JOOLA_DIRECT',
    'AUTHORIZED_RETAILER',
    'EBAY',
    'FACEBOOK_MARKETPLACE',
    'AUCTION_SITE',
    'UNKNOWN_ONLINE',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type product_type as enum (
    -- Pickleball
    'PADDLE_STANDARD',
    'PADDLE_NFC',
    'PICKLEBALL_NETS',
    'PICKLEBALL_BALLS',
    'COVERS_CASES',
    'BAGS',
    'EYEWEAR',
    'PADDLE_SETS',
    -- Table tennis
    'TT_INDOOR_TABLE',
    'TT_OUTDOOR_TABLE',
    'TT_CUSTOMIZED_RACKET',
    'TT_RACKET_SET',
    'TT_RECREATIONAL_RACKET',
    'IPONG_ROBOT',
    'TT_BLADES',
    'TT_RUBBERS',
    'TT_BALLS',
    'TT_TABLE_COVERS',
    'TT_NETS',
    'TT_BAGS',
    -- Apparel + other
    'APPAREL',
    'GRIPS',
    'GLUES',
    'CLEANERS',
    'EDGE_TAPES',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 3. REFERENCE TABLES (the 7 fixed AI agents)
-- =============================================================================

create table if not exists agents (
  id          text primary key,
  glyph       text not null,
  name        text not null,
  role        text not null,
  created_at  timestamptz default now()
);

insert into agents (id, glyph, name, role) values
  ('intake',  '01', 'Intake Normalizer', 'Normalizes raw input from voice/email/web into a canonical claim shape.'),
  ('shopify', '02', 'Order Verifier',    'Verifies order against Shopify (or mock) — source, authorized status, purchase date.'),
  ('warrreg', '03', 'Warranty Registry', 'Looks up NFC registration — registered? within 14 days? receipt approved?'),
  ('rules',   '04', 'Rule Engine',       'Deterministic Python policy engine — emits one of 4 decisions with citation.'),
  ('summary', '05', 'Claim Summary',     'Builds structured claim record and internal CS summary.'),
  ('response','06', 'Customer Reply',    'GPT-4o drafts voice + email reply in JOOLA voice. Cached system prompt.'),
  ('esc',     '07', 'Escalation Router', 'Routes HUMAN_REVIEW_REQUIRED cases to the right CS queue with reason code.')
on conflict (id) do update set
  glyph = excluded.glyph,
  name = excluded.name,
  role = excluded.role;

-- =============================================================================
-- 4. CUSTOMERS + ORDERS + REGISTRATIONS
-- =============================================================================

create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  country     text not null default 'US',  -- ISO-2: US, CA, PR (warranty), others get NOT_ELIGIBLE
  phone       text,
  created_at  timestamptz default now()
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  customer_id     uuid not null references customers(id) on delete cascade,
  product_name    text not null,
  product_sku     text not null,
  product_type    product_type not null,
  purchase_date   date not null,
  source          order_source not null default 'JOOLA_DIRECT',
  authorized      boolean generated always as (source in ('JOOLA_DIRECT', 'AUTHORIZED_RETAILER')) stored,
  created_at      timestamptz default now()
);

create table if not exists registrations (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references orders(id) on delete cascade,
  registered          boolean not null default false,
  nfc_id              text,
  registered_at       timestamptz,
  -- within_window cannot be a GENERATED column because Postgres forbids
  -- subqueries in generation expressions and we need to look up the parent
  -- order's purchase_date. Maintained by trigger set_registration_within_window
  -- defined later in this migration.
  within_window       boolean not null default false,
  receipt_uploaded    boolean not null default false,
  receipt_approved    boolean not null default false,
  approved_at         timestamptz,
  created_at          timestamptz default now()
);

-- =============================================================================
-- 5. CLAIMS (the central entity)
-- =============================================================================

-- Sequence for human-readable WC-XXXXX ids
create sequence if not exists claim_id_seq start with 10001;

create table if not exists claims (
  id                 text primary key default ('WC-' || lpad(nextval('claim_id_seq')::text, 5, '0')),
  customer_id        uuid not null references customers(id) on delete restrict,
  order_id           uuid references orders(id) on delete set null,
  channel            channel_type not null,
  issue              text not null,
  status_detail      claim_status_detail not null default 'NEW',
  display_status     display_status_type generated always as (
    case
      when status_detail in (
        'CLOSED_RESOLVED','CLOSED_DECLINED','CLOSED_EXPIRED','CLOSED_NO_RESPONSE','CANCELLED'
      ) then 'CLOSED'::display_status_type
      when status_detail = 'REOPENED' then 'REOPENED'::display_status_type
      else 'OPEN'::display_status_type
    end
  ) stored,
  decision           decision_type not null default 'PROCESSING',
  reason_code        text,                           -- e.g., UNAUTHORIZED_SELLER, NFC_LATE
  citation           text,                           -- e.g., '§1.7, §2.3'
  policy_version     text not null default '1.0.0',
  primary_agent_id   text references agents(id),    -- which agent finalized: rules / esc / response
  sentiment          numeric(3,2),                   -- 0.00 to 1.00
  stage              text not null default 'intake', -- intake / verify / rules / draft / closed
  created_at         timestamptz not null default now(),
  closed_at          timestamptz,
  handle_seconds     int generated always as (
    case when closed_at is not null
      then extract(epoch from (closed_at - created_at))::int
      else null
    end
  ) stored,
  reopened_at        timestamptz,
  reopen_category    reopen_category,
  reopen_note        text,
  constraint reopen_consistency check (
    (reopened_at is null and reopen_category is null and reopen_note is null) or
    (reopened_at is not null and reopen_category is not null and reopen_note is not null and char_length(reopen_note) >= 5)
  )
);

-- =============================================================================
-- 6. AGENT STATES (live per-agent state, 1 row per agent)
-- =============================================================================

create table if not exists agent_states (
  agent_id          text primary key references agents(id) on delete cascade,
  state             agent_state_type not null default 'idle',
  queue_depth       int not null default 0,
  handled_today     int not null default 0,
  avg_ms            int not null default 0,
  load_pct          int not null default 0 check (load_pct between 0 and 100),
  current_task_for  text references claims(id) on delete set null,
  updated_at        timestamptz not null default now()
);

-- Seed one row per agent so the dashboard has data to subscribe to
insert into agent_states (agent_id, state, queue_depth, handled_today, avg_ms, load_pct)
select id, 'idle', 0, 0, 0, 0 from agents
on conflict (agent_id) do nothing;

-- =============================================================================
-- 7. TRANSCRIPTS (voice call lines, streamed live)
-- =============================================================================

create table if not exists transcripts (
  id           bigserial primary key,
  claim_id     text not null references claims(id) on delete cascade,
  line_index   int not null,
  who          text not null check (who in ('CUSTOMER', 'AI')),
  txt          text not null,
  created_at   timestamptz not null default now(),
  unique (claim_id, line_index)
);

-- =============================================================================
-- 8. EMAILS (DB-simulated email channel, no SMTP)
-- =============================================================================

create table if not exists emails (
  id          uuid primary key default gen_random_uuid(),
  claim_id    text not null references claims(id) on delete cascade,
  direction   text not null check (direction in ('inbound', 'outbound')),
  from_addr   text not null,
  to_addr     text not null,
  subject     text not null,
  body        text not null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- 9. DRAFTS (AI-generated replies awaiting CS Lead approval)
-- =============================================================================

create table if not exists drafts (
  id                uuid primary key default gen_random_uuid(),
  claim_id          text not null references claims(id) on delete cascade,
  voice_text        text,
  email_subject     text,
  email_body        text,
  internal_summary  text,
  status            text not null default 'pending_approval'
                    check (status in ('pending_approval', 'approved', 'edited', 'rejected')),
  approved_by       text,                              -- CS Lead identifier (no auth in demo)
  approved_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- 10. ESCALATIONS (right-panel queue)
-- =============================================================================

create table if not exists escalations (
  id            text primary key references claims(id) on delete cascade,
  priority      escalation_priority not null default 'norm',
  reason        escalation_reason not null,
  wait_minutes  int not null default 0,
  summary       text not null,
  claimed_by    text,                                  -- CS Lead identifier (no auth in demo)
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- 11. CASE EVENTS (audit trail — high volume, all actions written here)
-- =============================================================================

create table if not exists case_events (
  id              uuid primary key default gen_random_uuid(),
  claim_id        text not null references claims(id) on delete cascade,
  event_type      text not null,           -- AI_*, CS_*, CUST_*, SYS_*
  actor_type      actor_type_enum not null,
  actor_id        text,                    -- agent id, user id, customer id, or 'system'
  payload         jsonb not null default '{}'::jsonb,
  policy_version  text not null default '1.0.0',
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- 12. CSV EXPORTS (for archive export jobs — synchronous for demo, table for future async)
-- =============================================================================

create table if not exists csv_exports (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,                                  -- CS Lead identifier (no auth in demo)
  filters       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'ready', 'failed')),
  row_count     int,
  storage_path  text,
  error_message text,
  created_at    timestamptz not null default now(),
  ready_at      timestamptz
);

-- =============================================================================
-- 13. INDEXES
-- =============================================================================

-- claims hot paths
create index if not exists idx_claims_created_at         on claims (created_at desc);
create index if not exists idx_claims_display_status     on claims (display_status, created_at desc);
create index if not exists idx_claims_status_detail      on claims (status_detail, created_at desc);
create index if not exists idx_claims_channel            on claims (channel, created_at desc);
create index if not exists idx_claims_decision           on claims (decision, created_at desc);
create index if not exists idx_claims_primary_agent      on claims (primary_agent_id, created_at desc);
create index if not exists idx_claims_customer           on claims (customer_id);
create index if not exists idx_claims_order              on claims (order_id);

-- archive search (GIN trigram on text fields)
create index if not exists idx_claims_issue_trgm         on claims using gin (issue gin_trgm_ops);
create index if not exists idx_claims_id_trgm            on claims using gin (id gin_trgm_ops);
create index if not exists idx_customers_name_trgm       on customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_email_trgm      on customers using gin (email gin_trgm_ops);
create index if not exists idx_orders_number_trgm        on orders using gin (order_number gin_trgm_ops);
create index if not exists idx_orders_product_name_trgm  on orders using gin (product_name gin_trgm_ops);

-- transcripts (already has unique constraint, but ordered reads need created_at)
create index if not exists idx_transcripts_claim         on transcripts (claim_id, line_index);

-- emails
create index if not exists idx_emails_claim              on emails (claim_id, created_at desc);
create index if not exists idx_emails_direction          on emails (direction, created_at desc);

-- escalations
create index if not exists idx_escalations_priority      on escalations (priority, created_at desc);

-- case_events (high volume — needs all three for different query patterns)
create index if not exists idx_case_events_claim         on case_events (claim_id, created_at desc);
create index if not exists idx_case_events_actor         on case_events (actor_id, created_at desc);
create index if not exists idx_case_events_event_type    on case_events (event_type, created_at desc);
create index if not exists idx_case_events_created       on case_events (created_at desc);

-- =============================================================================
-- 14. SUPABASE REALTIME PUBLICATION
--     Tables that the dashboard subscribes to for live updates.
--     replica identity full = old+new row sent on UPDATE (needed for diff'ing).
-- =============================================================================

-- Add tables to the realtime publication (idempotent via DO block)
do $$
declare
  t text;
  tables text[] := array['claims', 'agent_states', 'escalations', 'transcripts', 'emails', 'drafts'];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;  -- already in publication
    end;
  end loop;
end $$;

alter table claims        replica identity full;
alter table agent_states  replica identity full;
alter table escalations   replica identity full;

-- =============================================================================
-- 15. ROW LEVEL SECURITY
--     Demo posture (no auth): anon key has full access to everything.
--                             Python backend uses sb_secret_* which bypasses RLS.
--     ⚠ TIGHTEN BEFORE PRODUCTION: wire Supabase Auth, scope policies per user.
-- =============================================================================

alter table customers      enable row level security;
alter table orders         enable row level security;
alter table registrations  enable row level security;
alter table claims         enable row level security;
alter table agents         enable row level security;
alter table agent_states   enable row level security;
alter table transcripts    enable row level security;
alter table emails         enable row level security;
alter table drafts         enable row level security;
alter table escalations    enable row level security;
alter table case_events    enable row level security;
alter table csv_exports    enable row level security;

-- DEMO ONLY: anon key has full access. Replace with per-user policies once auth is wired.
do $$
declare
  t text;
  tables text[] := array[
    'customers','orders','registrations','claims','agents','agent_states',
    'transcripts','emails','drafts','escalations','case_events','csv_exports'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists demo_anon_all on public.%I', t);
    execute format(
      'create policy demo_anon_all on public.%I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- 16. TRIGGERS
-- =============================================================================

-- 16a. keep agent_states.updated_at fresh on every change
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agent_states_touch on agent_states;
create trigger trg_agent_states_touch
  before update on agent_states
  for each row execute function touch_updated_at();

-- 16b. compute registrations.within_window from the parent order's purchase_date.
-- Replaces what would otherwise be a GENERATED column (Postgres forbids subqueries
-- in generation expressions). Fires on INSERT and UPDATE to keep the flag in sync.
create or replace function set_registration_within_window() returns trigger as $$
declare
  v_purchase_date date;
begin
  if new.registered_at is null then
    new.within_window := false;
    return new;
  end if;

  select purchase_date into v_purchase_date
    from orders where id = new.order_id;

  if v_purchase_date is null then
    new.within_window := false;
  else
    -- §2.5: NFC registration must happen within 14 days of purchase.
    new.within_window := new.registered_at::date <= (v_purchase_date + interval '14 days')::date;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_registrations_within_window on registrations;
create trigger trg_registrations_within_window
  before insert or update of registered_at, order_id on registrations
  for each row execute function set_registration_within_window();

commit;

-- =============================================================================
-- DONE.
-- Verify in Supabase Dashboard -> Table Editor:
--   - 12 tables created
--   - 7 rows in `agents`, 7 rows in `agent_states`
--   - Realtime enabled on: claims, agent_states, escalations, transcripts, emails, drafts
-- Next migration (0002): seed customers + orders + 280 archive claims for demo.
-- =============================================================================
