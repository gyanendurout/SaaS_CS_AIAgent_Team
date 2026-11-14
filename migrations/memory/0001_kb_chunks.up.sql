-- CS shared knowledge memory (pgvector).
-- NOT part of the numbered Supabase migrations in ../ — apply manually in the
-- Supabase SQL editor when enabling KNOWLEDGE_SOURCE=vector.
-- Rollback: 0001_kb_chunks.down.sql

set search_path = public, extensions;

create extension if not exists vector with schema extensions;

create table if not exists public.kb_chunks (
  id              bigint generated always as identity primary key,
  source          text        not null,               -- e.g. knowledge/shopify/paddle_registration.md
  heading         text        not null default '',
  content         text        not null,
  content_hash    text        not null unique,        -- sha256(source + content); drives incremental ingest
  embedding       vector(1536) not null,              -- text-embedding-3-small
  embedding_model text        not null,
  created_at      timestamptz not null default now()
);

create index if not exists kb_chunks_embedding_idx
  on public.kb_chunks using hnsw (embedding vector_cosine_ops);

-- Service role only: RLS on with no policies blocks anon/authenticated keys.
alter table public.kb_chunks enable row level security;

create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count     int   default 3,
  min_score       float default 0.3
)
returns table (source text, heading text, content text, score float)
language sql
stable
set search_path = public, extensions
as $$
  select c.source, c.heading, c.content, 1 - (c.embedding <=> query_embedding) as score
  from public.kb_chunks c
  where 1 - (c.embedding <=> query_embedding) >= min_score
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_kb_chunks(vector, int, float) from public, anon, authenticated;
