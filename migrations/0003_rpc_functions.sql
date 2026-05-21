-- =============================================================================
-- JOOLA AI CS Warranty Management System
-- Migration 0003: RPC Functions + Dashboard Views
-- Created: 2026-05-17
-- Policy version anchored: 1.0.0
--
-- Provides server-side, RLS-friendly filtering for the Archive tab and
-- aggregate views for the Dashboard. No new tables — RPCs + views only.
--
-- Filter shape mirrors design/src/Archive.jsx `filters` object:
--   { q, range, channel, decision, agent, status, flagSLA, flagEsc, flagUnauth }
--
-- Run AFTER 0001 + 0002.
-- Idempotent: CREATE OR REPLACE everywhere.
-- =============================================================================

begin;

-- Ensure enum types from migration 0001 are resolvable during CREATE FUNCTION
-- parsing. Supabase's SQL Editor session may not include 'public' in the
-- default search_path. This affects only this script's session.
set search_path to public, pg_catalog;

-- =============================================================================
-- 1. archive_query — paginated, filtered Archive feed
--    Mirrors design's applyFilters() + pagination from Archive.jsx.
--    Returns a `total_count` column (window) so the UI can render pager.
-- =============================================================================

create or replace function archive_query(
  p_q           text                  default null,
  p_range_days  int                   default 30,    -- pass NULL or 0 for "all time"
  p_channel     channel_type          default null,
  p_decision    decision_type         default null,
  p_agent       text                  default null,
  p_status      display_status_type   default null,
  p_flag_sla    boolean               default false,
  p_flag_esc    boolean               default false,
  p_flag_unauth boolean               default false,
  p_page        int                   default 0,
  p_page_size   int                   default 18
)
returns table (
  id              text,
  created_at      timestamptz,
  closed_at       timestamptz,
  handle_seconds  int,
  status          display_status_type,
  channel         channel_type,
  customer_name   text,
  customer_email  text,
  customer_country text,
  order_number    text,
  order_product   text,
  order_source    order_source,
  order_authorized boolean,
  issue           text,
  decision        decision_type,
  reason_code     text,
  primary_agent_id text,
  stage           text,
  total_count     bigint
)
language sql
stable
set search_path = public, pg_catalog
as $$
  -- Paginated archive search. Same filter semantics as Archive.jsx applyFilters().
  -- `total_count` is a window aggregate so the UI knows the unpaged size.
  with filtered as (
    select
      c.id,
      c.created_at,
      c.closed_at,
      c.handle_seconds,
      c.display_status,
      c.channel,
      cu.name    as customer_name,
      cu.email   as customer_email,
      cu.country as customer_country,
      o.order_number,
      o.product_name  as order_product,
      o.source        as order_source,
      coalesce(o.authorized, false) as order_authorized,
      c.issue,
      c.decision,
      c.reason_code,
      c.primary_agent_id,
      c.stage
    from claims c
    join customers cu on cu.id = c.customer_id
    left join orders o on o.id = c.order_id
    where
      (
        p_range_days is null
        or p_range_days <= 0
        or c.created_at >= (now() - (p_range_days || ' days')::interval)
      )
      and (p_channel  is null or c.channel  = p_channel)
      and (p_decision is null or c.decision = p_decision)
      and (p_agent    is null or c.primary_agent_id = p_agent)
      and (p_status   is null or c.display_status   = p_status)
      and (not p_flag_sla    or (c.handle_seconds is not null and c.handle_seconds > 600))
      and (not p_flag_esc    or c.decision = 'HUMAN_REVIEW_REQUIRED')
      -- Unauthorized = order link exists AND authorized=false.
      -- (Orders with NULL link are treated as "unknown", not unauthorized.)
      and (not p_flag_unauth or (o.id is not null and o.authorized = false))
      and (
        p_q is null or p_q = '' or
        cu.name        ilike '%' || p_q || '%' or
        cu.email       ilike '%' || p_q || '%' or
        c.issue        ilike '%' || p_q || '%' or
        c.id           ilike '%' || p_q || '%' or
        coalesce(o.order_number, '') ilike '%' || p_q || '%' or
        coalesce(o.product_name, '') ilike '%' || p_q || '%'
      )
  )
  select
    id, created_at, closed_at, handle_seconds, display_status, channel,
    customer_name, customer_email, customer_country,
    order_number, order_product, order_source, order_authorized,
    issue, decision, reason_code, primary_agent_id, stage,
    count(*) over () as total_count
  from filtered
  order by created_at desc
  limit  greatest(p_page_size, 1)
  offset greatest(p_page, 0) * greatest(p_page_size, 1);
$$;

comment on function archive_query is
  'Paginated, filtered claim search for the Archive tab. Mirrors design''s applyFilters() shape; returns total_count as a window for pagination.';

-- =============================================================================
-- 2. archive_aggregates(filters jsonb) — side-panel analytics for Archive
--    Returns a single jsonb object with 5 keys:
--      daily_volume        — [{date, count}, ...]   (one row per day in range)
--      decision_mix        — {ELIGIBLE: n, NOT_ELIGIBLE: n, ...}
--      agent_leaderboard   — [{agent_id, name, count}, ...] sorted desc
--      channel_mix         — {voice: n, email: n, web: n}
--      top_issues          — [{issue, count}, ...] top 6
--    Same WHERE logic as archive_query — but NO pagination.
-- =============================================================================

create or replace function archive_aggregates(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_q           text                := nullif(p_filters->>'q', '');
  v_range_days  int                 := coalesce((p_filters->>'range_days')::int, 30);
  v_channel     channel_type        := nullif(p_filters->>'channel', '')::channel_type;
  v_decision    decision_type       := nullif(p_filters->>'decision', '')::decision_type;
  v_agent       text                := nullif(p_filters->>'agent', '');
  v_status      display_status_type := nullif(p_filters->>'status', '')::display_status_type;
  v_flag_sla    boolean             := coalesce((p_filters->>'flag_sla')::boolean, false);
  v_flag_esc    boolean             := coalesce((p_filters->>'flag_esc')::boolean, false);
  v_flag_unauth boolean             := coalesce((p_filters->>'flag_unauth')::boolean, false);
  v_result      jsonb;
begin
  with filtered as (
    select c.*, cu.name as customer_name, cu.email as customer_email,
           o.id as o_id, o.order_number, o.product_name, o.authorized as o_auth
    from claims c
    join customers cu on cu.id = c.customer_id
    left join orders o on o.id = c.order_id
    where
      (v_range_days is null or v_range_days <= 0
        or c.created_at >= (now() - (v_range_days || ' days')::interval))
      and (v_channel  is null or c.channel  = v_channel)
      and (v_decision is null or c.decision = v_decision)
      and (v_agent    is null or c.primary_agent_id = v_agent)
      and (v_status   is null or c.display_status   = v_status)
      and (not v_flag_sla    or (c.handle_seconds is not null and c.handle_seconds > 600))
      and (not v_flag_esc    or c.decision = 'HUMAN_REVIEW_REQUIRED')
      and (not v_flag_unauth or (o.id is not null and o.authorized = false))
      and (
        v_q is null or
        cu.name        ilike '%' || v_q || '%' or
        cu.email       ilike '%' || v_q || '%' or
        c.issue        ilike '%' || v_q || '%' or
        c.id           ilike '%' || v_q || '%' or
        coalesce(o.order_number, '') ilike '%' || v_q || '%' or
        coalesce(o.product_name, '') ilike '%' || v_q || '%'
      )
  )
  select jsonb_build_object(
    'daily_volume',      (
      select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as d, count(*)::int as cnt
        from filtered
        group by 1
      ) dv
    ),
    'decision_mix',      (
      select coalesce(jsonb_object_agg(decision, cnt), '{}'::jsonb)
      from (
        select decision::text, count(*)::int as cnt
        from filtered
        group by decision
      ) dm
    ),
    'agent_leaderboard', (
      select coalesce(jsonb_agg(jsonb_build_object('agent_id', agent_id, 'name', name, 'count', cnt)
                                order by cnt desc), '[]'::jsonb)
      from (
        select a.id as agent_id, a.name, count(f.id)::int as cnt
          from agents a
          left join filtered f on f.primary_agent_id = a.id
          group by a.id, a.name
      ) al
    ),
    'channel_mix',       (
      select coalesce(jsonb_object_agg(channel, cnt), '{}'::jsonb)
      from (
        select channel::text, count(*)::int as cnt
        from filtered
        group by channel
      ) cm
    ),
    'top_issues',        (
      select coalesce(jsonb_agg(jsonb_build_object('issue', issue, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select issue, count(*)::int as cnt
        from filtered
        group by issue
        order by count(*) desc
        limit 6
      ) ti
    )
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

comment on function archive_aggregates is
  'Side-panel analytics for Archive: daily_volume, decision_mix, agent_leaderboard, channel_mix, top_issues. Filters mirror archive_query.';

-- =============================================================================
-- 3. dashboard_kpi — single-row view of live operational KPIs
--    Matches design's CS.seedKPI() shape (calls/emails/webForms today,
--    openClaims, autoResolve %, avgHandle, escalations, slaBreach).
-- =============================================================================

create or replace view dashboard_kpi as
with today as (
  select * from claims where created_at::date = current_date
),
closed_today as (
  select * from today where display_status = 'CLOSED' and handle_seconds is not null
)
select
  -- channel counts today
  (select count(*) from today where channel = 'voice')::int as calls_today,
  (select count(*) from today where channel = 'email')::int as emails_today,
  (select count(*) from today where channel = 'web')::int   as web_forms_today,

  -- open claims (any age)
  (select count(*) from claims where display_status = 'OPEN')::int as open_claims,

  -- auto-resolve % = closed today where primary_agent_id is not 'esc'
  case when (select count(*) from closed_today) = 0 then 0
    else round(
      100.0 *
      (select count(*) from closed_today where coalesce(primary_agent_id, '') <> 'esc')::numeric
      / (select count(*) from closed_today)::numeric
    )::int
  end as auto_resolve_pct,

  -- avg handle seconds for closed-today
  coalesce(
    (select round(avg(handle_seconds))::int from closed_today),
    0
  ) as avg_handle_seconds,

  -- active escalation queue depth
  (select count(*) from escalations)::int as escalations_count,

  -- SLA breach = open claim older than 60 minutes
  (select count(*) from claims
    where display_status = 'OPEN'
      and created_at < now() - interval '60 minutes')::int as sla_breach_count;

comment on view dashboard_kpi is
  'Single-row live KPI snapshot for the dashboard header. Matches design CS.seedKPI() shape.';

-- =============================================================================
-- 4. claim_pipeline_summary — 5 rows (intake / verify / rules / draft / closed)
--    stuck_count = open claims in this stage older than 30 minutes.
-- =============================================================================

create or replace view claim_pipeline_summary as
with stages(stage) as (
  values ('intake'), ('verify'), ('rules'), ('draft'), ('closed')
),
counts as (
  select stage, count(*)::int as cnt
    from claims
   group by stage
),
stuck as (
  select stage, count(*)::int as stuck_cnt
    from claims
   where display_status = 'OPEN'
     and created_at < now() - interval '30 minutes'
   group by stage
)
select
  s.stage,
  coalesce(c.cnt, 0)        as count,
  coalesce(st.stuck_cnt, 0) as stuck_count
from stages s
left join counts c on c.stage = s.stage
left join stuck  st on st.stage = s.stage
order by case s.stage
  when 'intake' then 1
  when 'verify' then 2
  when 'rules'  then 3
  when 'draft'  then 4
  when 'closed' then 5
end;

comment on view claim_pipeline_summary is
  '5 pipeline stages with count + stuck_count (open > 30min). Matches design CS.seedPipeline().';

-- =============================================================================
-- 5. decision_mix_today — counts grouped by decision for today's claims
-- =============================================================================

create or replace view decision_mix_today as
select
  decision,
  count(*)::int as count
from claims
where created_at::date = current_date
group by decision
order by count(*) desc;

comment on view decision_mix_today is
  'Today-only decision breakdown for the dashboard donut. One row per decision_type that appears.';

-- =============================================================================
-- 6. case_count_filtered — pre-flight count for export size check.
--    Same filter logic as archive_query.
-- =============================================================================

create or replace function case_count_filtered(p_filters jsonb default '{}'::jsonb)
returns bigint
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_q           text                := nullif(p_filters->>'q', '');
  v_range_days  int                 := coalesce((p_filters->>'range_days')::int, 30);
  v_channel     channel_type        := nullif(p_filters->>'channel', '')::channel_type;
  v_decision    decision_type       := nullif(p_filters->>'decision', '')::decision_type;
  v_agent       text                := nullif(p_filters->>'agent', '');
  v_status      display_status_type := nullif(p_filters->>'status', '')::display_status_type;
  v_flag_sla    boolean             := coalesce((p_filters->>'flag_sla')::boolean, false);
  v_flag_esc    boolean             := coalesce((p_filters->>'flag_esc')::boolean, false);
  v_flag_unauth boolean             := coalesce((p_filters->>'flag_unauth')::boolean, false);
  v_count       bigint;
begin
  select count(*) into v_count
  from claims c
  join customers cu on cu.id = c.customer_id
  left join orders o on o.id = c.order_id
  where
    (v_range_days is null or v_range_days <= 0
      or c.created_at >= (now() - (v_range_days || ' days')::interval))
    and (v_channel  is null or c.channel  = v_channel)
    and (v_decision is null or c.decision = v_decision)
    and (v_agent    is null or c.primary_agent_id = v_agent)
    and (v_status   is null or c.display_status   = v_status)
    and (not v_flag_sla    or (c.handle_seconds is not null and c.handle_seconds > 600))
    and (not v_flag_esc    or c.decision = 'HUMAN_REVIEW_REQUIRED')
    and (not v_flag_unauth or (o.id is not null and o.authorized = false))
    and (
      v_q is null or
      cu.name        ilike '%' || v_q || '%' or
      cu.email       ilike '%' || v_q || '%' or
      c.issue        ilike '%' || v_q || '%' or
      c.id           ilike '%' || v_q || '%' or
      coalesce(o.order_number, '') ilike '%' || v_q || '%' or
      coalesce(o.product_name, '') ilike '%' || v_q || '%'
    );

  return v_count;
end;
$$;

comment on function case_count_filtered is
  'Returns the unpaginated row count for a given filter set. Used as a pre-flight check before CSV export.';

-- =============================================================================
-- 7. archive_export — streams CSV rows for the filtered claim set.
--    First row is a header. Raises 'EXPORT_TOO_LARGE' if > 10,000 matches.
-- =============================================================================

create or replace function archive_export(p_filters jsonb default '{}'::jsonb)
returns setof text
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_q           text                := nullif(p_filters->>'q', '');
  v_range_days  int                 := coalesce((p_filters->>'range_days')::int, 30);
  v_channel     channel_type        := nullif(p_filters->>'channel', '')::channel_type;
  v_decision    decision_type       := nullif(p_filters->>'decision', '')::decision_type;
  v_agent       text                := nullif(p_filters->>'agent', '');
  v_status      display_status_type := nullif(p_filters->>'status', '')::display_status_type;
  v_flag_sla    boolean             := coalesce((p_filters->>'flag_sla')::boolean, false);
  v_flag_esc    boolean             := coalesce((p_filters->>'flag_esc')::boolean, false);
  v_flag_unauth boolean             := coalesce((p_filters->>'flag_unauth')::boolean, false);
  v_count       bigint;
  v_row         record;
begin
  -- Pre-flight size check (calls helper above for DRY).
  v_count := case_count_filtered(p_filters);
  if v_count > 10000 then
    raise exception 'EXPORT_TOO_LARGE: % rows exceed the 10,000-row CSV cap', v_count
      using errcode = 'P0001';
  end if;

  -- Header row
  return next 'id,created_at,closed_at,handle_seconds,status,channel,'
              || 'customer_name,customer_email,customer_country,'
              || 'order_number,order_product,order_source,order_authorized,'
              || 'issue,decision,reason_code,citation,primary_agent_id,stage';

  -- Data rows — quote+escape any field that may contain commas/quotes.
  for v_row in
    select
      c.id,
      c.created_at,
      c.closed_at,
      c.handle_seconds,
      c.display_status,
      c.channel,
      cu.name    as customer_name,
      cu.email   as customer_email,
      cu.country as customer_country,
      o.order_number,
      o.product_name as order_product,
      o.source       as order_source,
      coalesce(o.authorized, false) as order_authorized,
      c.issue,
      c.decision,
      c.reason_code,
      c.citation,
      c.primary_agent_id,
      c.stage
    from claims c
    join customers cu on cu.id = c.customer_id
    left join orders o on o.id = c.order_id
    where
      (v_range_days is null or v_range_days <= 0
        or c.created_at >= (now() - (v_range_days || ' days')::interval))
      and (v_channel  is null or c.channel  = v_channel)
      and (v_decision is null or c.decision = v_decision)
      and (v_agent    is null or c.primary_agent_id = v_agent)
      and (v_status   is null or c.display_status   = v_status)
      and (not v_flag_sla    or (c.handle_seconds is not null and c.handle_seconds > 600))
      and (not v_flag_esc    or c.decision = 'HUMAN_REVIEW_REQUIRED')
      and (not v_flag_unauth or (o.id is not null and o.authorized = false))
      and (
        v_q is null or
        cu.name        ilike '%' || v_q || '%' or
        cu.email       ilike '%' || v_q || '%' or
        c.issue        ilike '%' || v_q || '%' or
        c.id           ilike '%' || v_q || '%' or
        coalesce(o.order_number, '') ilike '%' || v_q || '%' or
        coalesce(o.product_name, '') ilike '%' || v_q || '%'
      )
    order by c.created_at desc
  loop
    return next
      v_row.id
      || ',' || coalesce(to_char(v_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')
      || ',' || coalesce(to_char(v_row.closed_at  at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')
      || ',' || coalesce(v_row.handle_seconds::text, '')
      || ',' || v_row.display_status::text
      || ',' || v_row.channel::text
      || ',' || '"' || replace(coalesce(v_row.customer_name,   ''), '"', '""') || '"'
      || ',' || '"' || replace(coalesce(v_row.customer_email,  ''), '"', '""') || '"'
      || ',' || coalesce(v_row.customer_country, '')
      || ',' || '"' || replace(coalesce(v_row.order_number,    ''), '"', '""') || '"'
      || ',' || '"' || replace(coalesce(v_row.order_product,   ''), '"', '""') || '"'
      || ',' || coalesce(v_row.order_source::text, '')
      || ',' || v_row.order_authorized::text
      || ',' || '"' || replace(coalesce(v_row.issue,           ''), '"', '""') || '"'
      || ',' || v_row.decision::text
      || ',' || '"' || replace(coalesce(v_row.reason_code,     ''), '"', '""') || '"'
      || ',' || '"' || replace(coalesce(v_row.citation,        ''), '"', '""') || '"'
      || ',' || coalesce(v_row.primary_agent_id, '')
      || ',' || coalesce(v_row.stage, '');
  end loop;

  return;
end;
$$;

comment on function archive_export is
  'Streams CSV rows for the filtered Archive set. First row is header. Raises EXPORT_TOO_LARGE if > 10k rows.';

-- =============================================================================
-- 8. GRANTS — anon role gets execute on all RPCs + read on all views
--    (Matches the demo RLS posture in 0001 — full anon access.)
-- =============================================================================

grant execute on function archive_query(
  text, int, channel_type, decision_type, text, display_status_type,
  boolean, boolean, boolean, int, int
) to anon, authenticated;

grant execute on function archive_aggregates(jsonb)    to anon, authenticated;
grant execute on function case_count_filtered(jsonb)   to anon, authenticated;
grant execute on function archive_export(jsonb)        to anon, authenticated;

grant select on dashboard_kpi             to anon, authenticated;
grant select on claim_pipeline_summary    to anon, authenticated;
grant select on decision_mix_today        to anon, authenticated;

commit;

-- =============================================================================
-- DONE.
-- Exposed surface:
--   FUNCTIONS: archive_query, archive_aggregates, case_count_filtered, archive_export
--   VIEWS:     dashboard_kpi, claim_pipeline_summary, decision_mix_today
-- All readable via PostgREST as:
--   POST /rest/v1/rpc/archive_query
--   POST /rest/v1/rpc/archive_aggregates
--   GET  /rest/v1/dashboard_kpi
--   GET  /rest/v1/claim_pipeline_summary
--   GET  /rest/v1/decision_mix_today
-- =============================================================================
