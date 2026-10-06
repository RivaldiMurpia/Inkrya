-- Phase 2: pgvector semantic memory + structured canon upgrade
-- Apply to live Supabase via SQL Editor (one-time). Never reapply.
-- Prerequisites: memory.sql, memory-approved-retrieval.sql already applied.
-- Embedding model: Qwen/Qwen3-Embedding-8B via Nebius, dimensions=4096.

-- 1. Enable pgvector (idempotent)
create extension if not exists vector;

-- 2. story_embeddings: one row per chunk per model, revision-safe
-- pgvector supports vector storage up to 16,000 dimensions.
-- Indexing: 4,096 dimensions exceeds pgvector index limits (2,000 for vector, 4,000 for halfvec).
-- Per-project sequential scan over 200-500 chunks per novel is exact, takes <1ms, and avoids index errors.
create table public.story_embeddings (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null,
  chunk_id        uuid not null,
  source_revision bigint not null,
  source_hash     text not null,
  model           text not null,          -- "nebius:Qwen/Qwen3-Embedding-8B"
  embedding       vector(4096) not null,
  created_at      timestamptz not null default now(),
  foreign key(chunk_id, project_id) references public.story_chunks(id, project_id) on delete cascade,
  unique(chunk_id, model)                 -- one embedding per chunk per model
);

-- B-tree index on project_id and chunk_id for instant filtered scan
create index story_embeddings_project on public.story_embeddings(project_id, chunk_id);

alter table public.story_embeddings enable row level security;
revoke all on public.story_embeddings from anon, authenticated;
grant select, insert, update, delete on public.story_embeddings to authenticated;
create policy embeddings_owner on public.story_embeddings for all to authenticated
  using  (exists(select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (exists(select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

-- 3. Upgrade story_facts: add structured canon columns (nullable, backward-compatible)
-- Existing pending/approved/ignored rows stay unchanged.
alter table public.story_facts
  add column if not exists subject          text check(length(subject) between 1 and 500),
  add column if not exists predicate        text check(length(predicate) between 1 and 200),
  add column if not exists object           text check(length(object) between 1 and 500),
  add column if not exists source_chapter_id uuid references public.chapters(id) on delete set null,
  add column if not exists confidence       real check(confidence between 0 and 1);

-- Extend status to include canon states; keep old values for backward compat
alter table public.story_facts drop constraint if exists story_facts_status_check;
alter table public.story_facts add constraint story_facts_status_check
  check(status in ('pending', 'approved', 'ignored', 'CANON', 'PROPOSED', 'RETRACTED', 'CONFLICTED'));

-- 4. Retrieval-active chunks that still lack an embedding for the given model.
-- The chunker runs inside PostgreSQL, so embeddings are filled by the app worker.
create function public.memory_pending_embeddings(p_project_id uuid,p_model text,p_limit integer default 40)
returns table(id uuid,content text,source_revision bigint,source_hash text)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return query
 select s.id,s.content,s.source_revision,s.source_hash
 from public.story_chunks s
 join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
 join public.memory_jobs j on j.chapter_id=c.id
 left join public.story_embeddings e on e.chunk_id=s.id and e.model=p_model
 where s.project_id=p_project_id and s.source_revision=c.revision_number
  and s.source_hash=md5(c.plain_text) and j.status='ready' and e.id is null
 order by c.position,s.chunk_index limit greatest(1,least(p_limit,60));
end $$;
revoke all on function public.memory_pending_embeddings(uuid,text,integer) from public;
grant execute on function public.memory_pending_embeddings(uuid,text,integer) to authenticated;
