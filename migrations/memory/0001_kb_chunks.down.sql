-- Rollback for 0001_kb_chunks.up.sql.
-- Leaves the `vector` extension installed (other objects may depend on it).

set search_path = public, extensions;

drop function if exists public.match_kb_chunks(vector, int, float);
drop table if exists public.kb_chunks;
