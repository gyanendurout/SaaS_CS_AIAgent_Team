-- Gap log: questions the voice tools could not answer (GAP_LOG=on in ai-agents).
-- Additive only. Server-side access (service role); no anon/authenticated access.
-- Never stores email or postcode: order gaps keep order-number digits + outcome.

create table if not exists public.kb_gaps (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  channel     text not null default 'voice',
  tool        text not null,
  gap_type    text not null,
  query       text check (query is null or char_length(query) <= 300),
  detail      jsonb not null default '{}'::jsonb,
  reviewed    boolean not null default false
);

create index if not exists kb_gaps_created_at_idx on public.kb_gaps (created_at desc);
create index if not exists kb_gaps_type_idx on public.kb_gaps (gap_type, created_at desc);

alter table public.kb_gaps enable row level security;
revoke all on public.kb_gaps from anon, authenticated;

comment on table public.kb_gaps is
  'Unanswered voice-tool questions (knowledge_empty, products_empty, order_*). Written by ai-agents; read via GET /reports/gaps.';
