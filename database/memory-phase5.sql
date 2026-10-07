-- Phase 5: Canon Update — proposed canon diff with explicit approval.
-- One-time via apply_migration named canon_update_phase5; never reapply.
-- New accepted rows use status='CANON'; the legacy 'approved' vocabulary on
-- story_facts is NOT renamed (HACKATHON_IMPLEMENTATION.md:48). Retrieval already
-- reads both ('approved','CANON') for facts and status='CANON' for events/knowledge,
-- so acceptance becomes retrievable live with no re-chunk/re-embed step.
-- Re-indexing therefore = live retrieval; chapter text never changes on accept.

-- 1. canon_proposals: named in STORY_MEMORY_ARCHITECTURE.md §17. Proposals are born
--    from a write generation, attach to a chapter only after the author applies the
--    draft, and become canon rows only through decide_canon_proposals.
create table public.canon_proposals (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null,
  generation_id   uuid references public.ai_generations(id) on delete set null,
  chapter_id      uuid,
  target_kind     text not null check(target_kind in ('fact','event','knowledge')),
  payload         jsonb not null,
  quote           text not null check(length(quote) between 5 and 500),
  evidence_ids    jsonb not null default '[]'::jsonb,
  status          text not null default 'proposed' check(status in ('proposed','accepted','rejected')),
  dedup_key       text not null,
  source_revision bigint not null,
  source_hash     text not null,
  target_id       uuid,
  revision        integer not null default 0,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  unique(project_id, dedup_key)
);
create index canon_proposals_project on public.canon_proposals(project_id,status);
create index canon_proposals_generation on public.canon_proposals(generation_id);
create index canon_proposals_chapter on public.canon_proposals(chapter_id,project_id);
alter table public.canon_proposals
  add foreign key (chapter_id, project_id) references public.chapters(id, project_id) on delete cascade;

do $$ declare t text; begin
 execute 'alter table public.canon_proposals enable row level security';
 -- canon_proposals is pure RPC-mediated state (save/attach/decide): authenticated gets
 -- SELECT only. A direct UPDATE could mark a proposal accepted with no canon row behind it
 -- (bypassing the approval invariant); a direct INSERT could forge payload rows.
 execute 'revoke all on public.canon_proposals from anon,authenticated';
 execute 'grant select on public.canon_proposals to authenticated';
 execute 'create policy memory_owner on public.canon_proposals for select to authenticated using (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))';
end $$;

-- 2. save_canon_proposals: called by the write route after the graph returns.
--    Provenance-checked (generation must belong to owner+project), quotes re-validated
--    against the DRAFT the model just wrote (the draft is not a chapter yet), deduped
--    per generation. Best-effort from the route's perspective: failures are logged, not
--    thrown into the stream.
create function public.save_canon_proposals(
  p_project_id uuid,p_generation_id uuid,p_draft text,p_proposals jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare g public.ai_generations;p jsonb;kind text;claim text;quote text;
 pos integer;before text;after text;grounded boolean;saved integer:=0;
begin
 if auth.uid() is null or not exists(select 1 from public.projects pr where pr.id=p_project_id and pr.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 select * into g from public.ai_generations where id=p_generation_id and project_id=p_project_id and user_id=auth.uid();
 if not found then raise exception 'NOT_FOUND';end if;
 if jsonb_typeof(p_proposals)<>'array' or jsonb_array_length(p_proposals)>5 then raise exception 'INVALID_PROPOSALS';end if;
 for p in select value from jsonb_array_elements(p_proposals) loop
  kind:=p->>'target_kind';
  claim:=p->>'claim';
  quote:=left(p->>'quote',500);
  -- Quote cap 320: the chunker overlap is 319 chars, so a longer verbatim quote can span a
  -- chunk boundary and never match one story_chunk at acceptance. Floor 20 plus a
  -- word-boundary check keeps a mid-word fragment ('ndela' inside 'jendela') from posing
  -- as verbatim evidence.
  pos:=strpos(p_draft,quote);
  before:=case when pos>1 then substr(p_draft,pos-1,1) else '' end;
  after:=substr(p_draft,pos+length(quote),1);
  grounded:=pos>0 and length(quote) between 20 and 320
   and (before='' or before !~ '[A-Za-z0-9]')
   and (after='' or after !~ '[A-Za-z0-9]');
  if kind in ('fact','event','knowledge') and length(claim) between 1 and 500 and grounded then
   insert into public.canon_proposals(project_id,generation_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
   values(p_project_id,p_generation_id,kind,p,
    quote,coalesce(p->'evidence_ids','[]'::jsonb),
    md5(p_generation_id::text||':'||kind||':'||lower(btrim(claim))),
    0,'DRAFT')
   on conflict(project_id,dedup_key) do nothing;
   saved:=saved+1;
  end if;
 end loop;
 return saved;
end $$;
revoke all on function public.save_canon_proposals(uuid,uuid,text,jsonb) from public;
grant execute on function public.save_canon_proposals(uuid,uuid,text,jsonb) to authenticated;

-- 3. attach_canon_proposals: called by write-panel apply() after save_chapter succeeds.
--    Encodes arch §6 — canon derives from the explicitly accepted manuscript. Binds every
--    still-proposed row of the generation to the applied chapter and snapshots the chapter
--    revision for later STALE_SOURCE checks.
create function public.attach_canon_proposals(p_generation_id uuid,p_chapter_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.chapters;bound integer;
begin
 if auth.uid() is null then raise exception 'NOT_FOUND';end if;
 select * into c from public.chapters where id=p_chapter_id for share;
 if not found or c.project_id is null or not exists(select 1 from public.projects pr where pr.id=c.project_id and pr.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 update public.canon_proposals cp
  set chapter_id=p_chapter_id,source_revision=c.revision_number,source_hash=md5(c.plain_text)
  where cp.generation_id=p_generation_id and cp.status='proposed' and cp.project_id=c.project_id;
 get diagnostics bound=row_count;
 return bound;
end $$;
revoke all on function public.attach_canon_proposals(uuid,uuid) from public;
grant execute on function public.attach_canon_proposals(uuid,uuid) to authenticated;

-- 4. decide_canon_proposals: explicit author approval. ONE transaction, all-or-nothing:
--    any raise rolls back every item in the batch. Per item: FOR UPDATE, skip-if-decided
--    (idempotent no-op returning the existing target), CAS on revision (REVISION_CONFLICT),
--    and for acceptance a verbatim-quote resolve against the bound chapter's current chunks
--    plus STALE_SOURCE gating. p_edits maps proposal id -> edited claim/title/statement;
--    the edited text is what commits to canon, the proposal payload keeps the original.
create function public.decide_canon_proposals(p_decisions jsonb,p_edits jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb;pr public.canon_proposals;c public.chapters;s public.story_chunks;
 target uuid;edited text;f jsonb;decided integer:=0;
begin
 if auth.uid() is null then raise exception 'NOT_FOUND';end if;
 if jsonb_typeof(p_decisions)<>'array' or jsonb_array_length(p_decisions)=0 or jsonb_array_length(p_decisions)>20 then raise exception 'INVALID_DECISIONS';end if;
 for d in select value from jsonb_array_elements(p_decisions) loop
  select * into pr from public.canon_proposals
   where id=(d->>'id')::uuid
    and exists(select 1 from public.projects x where x.id=project_id and x.owner_id=auth.uid())
   for update;
  if not found then raise exception 'NOT_FOUND';end if;
  -- Idempotent re-decide: already-decided rows are no-ops, not duplicates.
  if pr.status<>'proposed' then continue;end if;
  if d->>'decision' not in ('accepted','rejected') then raise exception 'INVALID_DECISIONS';end if;
  -- Optimistic concurrency: the caller's revision must still match the locked row. Comparing
  -- against pr.revision alone would always succeed (it was just read) and silently accept a
  -- decision made against a stale view.
  if (d->>'revision') is null or pr.revision<>(d->>'revision')::integer then raise exception 'REVISION_CONFLICT';end if;
  edited:=coalesce(nullif(p_edits->>pr.id::text,''),pr.payload->>'claim');
  if length(edited) not between 1 and 1000 then raise exception 'INVALID_EDIT';end if;

  if d->>'decision'='rejected' then
   update public.canon_proposals set status='rejected',decided_at=now()
    where id=pr.id and revision=pr.revision;
   if not found then raise exception 'REVISION_CONFLICT';end if;
   decided:=decided+1;continue;
  end if;

  -- Acceptance: the proposal must be attached to a chapter and its quote must survive
  -- verbatim in a current chunk of that chapter (fail-closed otherwise).
  if pr.chapter_id is null then raise exception 'PROPOSAL_NOT_ATTACHED';end if;
  select * into c from public.chapters where id=pr.chapter_id for share;
  if not found then raise exception 'STALE_SOURCE';end if;
  select * into s from public.story_chunks
   where chapter_id=c.id and project_id=c.project_id
    and source_revision=c.revision_number and source_hash=md5(c.plain_text)
    and strpos(content,pr.quote)>0
   order by chunk_index limit 1;
  if not found then raise exception 'QUOTE_NOT_IN_CHAPTER';end if;

  if pr.target_kind='fact' then
   insert into public.story_facts(project_id,chunk_id,claim,quote,subject,predicate,object,source_chapter_id,confidence,status)
   values(pr.project_id,s.id,left(edited,1000),pr.quote,
    nullif(left(pr.payload->>'subject',500),''),nullif(left(pr.payload->>'predicate',200),''),nullif(left(pr.payload->>'object',500),''),
    c.id,case when (pr.payload->>'confidence')~'^[0-9]+([.][0-9]+)?$' then least(1,greatest(0,(pr.payload->>'confidence')::real)) end,'CANON')
   returning id into target;
  elsif pr.target_kind='event' then
   if coalesce(pr.payload->>'story_time','')='' or coalesce(pr.payload->>'event_type','') not in ('event','birth','death','discovery','meeting','conflict','reveal','other') then raise exception 'INVALID_PROPOSALS';end if;
   insert into public.timeline_events(project_id,chapter_id,story_time,title,description,event_type,chunk_id,quote,status)
   values(pr.project_id,c.id,left(pr.payload->>'story_time',100),left(edited,300),left(coalesce(pr.payload->>'description',''),1000),pr.payload->>'event_type',s.id,pr.quote,'CANON')
   returning id into target;
  else
   if coalesce(nullif(pr.payload->>'character',''),'')='' then raise exception 'INVALID_PROPOSALS';end if;
   -- RETURNING on the insert-select keeps target_id provenance deterministic even when two
   -- same-quote knowledge proposals are accepted in one batch (created_at ties).
   with ins as (
    insert into public.character_knowledge(project_id,character_id,fact_key,statement,knows,learned_at_chapter_id,learned_at_story_time,chunk_id,quote,status)
    select pr.project_id,ch.id,left(coalesce(nullif(pr.payload->>'fact_key',''),left(edited,200)),200),left(edited,1000),
     coalesce((pr.payload->>'knows')::boolean,true),c.id,nullif(left(pr.payload->>'story_time',100),''),s.id,pr.quote,'CANON'
    from public.characters ch
    where ch.project_id=pr.project_id and ch.deleted_at is null and ch.name=pr.payload->>'character'
    returning id
   )
   select id into target from ins;
   if not found then raise exception 'CHARACTER_NOT_FOUND';end if;
  end if;

  update public.canon_proposals set status='accepted',decided_at=now(),target_id=target
   where id=pr.id and revision=pr.revision;
  if not found then raise exception 'REVISION_CONFLICT';end if;
  decided:=decided+1;
 end loop;
 return jsonb_build_object('decided',decided);
end $$;
revoke all on function public.decide_canon_proposals(jsonb,jsonb) from public;
grant execute on function public.decide_canon_proposals(jsonb,jsonb) to authenticated;

-- 5. memory_overview gains a 'proposals' backlog section (new signature; drop old first).
drop function if exists public.memory_overview(uuid);
create function public.memory_overview(p_project_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object(
 'jobs',coalesce((select jsonb_agg(x) from (select j.*,c.title,c.story_time from public.memory_jobs j join public.chapters c on c.id=j.chapter_id where j.project_id=p_project_id order by c.position) x),'[]'::jsonb),
 'chunks',coalesce((select jsonb_agg(x) from (select s.id,s.chapter_id,c.title,s.source_revision,s.chunk_index,(i.id is not null) analyzed from public.story_chunks s join public.chapters c on c.id=s.chapter_id left join public.memory_insights i on i.chunk_id=s.id where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) order by c.position,s.chunk_index limit 500) x),'[]'::jsonb),
 'insights',coalesce((select jsonb_agg(x) from (select i.id,i.chunk_id,i.summary,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.memory_insights i join public.story_chunks s on s.id=i.chunk_id join public.chapters c on c.id=s.chapter_id where i.project_id=p_project_id order by i.created_at desc limit 100) x),'[]'::jsonb),
 'facts',coalesce((select jsonb_agg(x) from (select f.*,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.story_facts f join public.story_chunks s on s.id=f.chunk_id join public.chapters c on c.id=s.chapter_id where f.project_id=p_project_id order by f.created_at desc limit 100) x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from (select e.*,s.chunk_index,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.timeline_events e join public.story_chunks s on s.id=e.chunk_id left join public.chapters c on c.id=e.chapter_id where e.project_id=p_project_id order by e.story_time,e.created_at desc limit 100) x),'[]'::jsonb),
 'knowledge',coalesce((select jsonb_agg(x) from (select k.*,ch.name character_name,ch.aliases,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.character_knowledge k join public.characters ch on ch.id=k.character_id join public.story_chunks s on s.id=k.chunk_id left join public.chapters c on c.id=s.chapter_id where k.project_id=p_project_id order by k.created_at desc limit 100) x),'[]'::jsonb),
 'proposals',coalesce((select jsonb_agg(x) from (
  select cp.id,cp.generation_id,cp.target_kind,cp.payload,cp.quote,cp.status,cp.revision,cp.target_id,cp.chapter_id,c.title,(cp.chapter_id is not null and s.id is not null) current
  from public.canon_proposals cp
  left join public.chapters c on c.id=cp.chapter_id
  left join lateral (select sc.id,sc.source_revision,sc.source_hash from public.story_chunks sc where sc.chapter_id=cp.chapter_id and sc.source_revision=c.revision_number and sc.source_hash=md5(c.plain_text) and strpos(sc.content,cp.quote)>0 order by sc.chunk_index limit 1) s on true
  where cp.project_id=p_project_id
  order by cp.created_at desc limit 100) x),'[]'::jsonb)
 );
end $$;
revoke all on function public.memory_overview(uuid) from public;
grant execute on function public.memory_overview(uuid) to authenticated;
