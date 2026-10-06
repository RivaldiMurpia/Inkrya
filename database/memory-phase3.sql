-- Phase 3: Ask Your Story — story time, character knowledge, timeline events.
-- Apply AFTER database/memory-phase2.sql. One-time via apply_migration; never reapply.
-- New canon rows land as PROPOSED (facts stay pending) — nothing is auto-canon.

-- 1. Story-time label on chapters. Free text (novels may not use real dates).
--    Null = unknown; never guessed by AI or retrieval.
alter table public.chapters
  add column if not exists story_time text check(length(story_time) between 1 and 100);

-- 2. Character knowledge: who knows what, from which verbatim evidence.
create table public.character_knowledge (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null,
  character_id          uuid not null references public.characters(id) on delete cascade,
  fact_key              text not null check(length(fact_key) between 1 and 200),
  statement             text not null check(length(statement) between 1 and 1000),
  knows                 boolean not null default true,
  learned_at_chapter_id uuid references public.chapters(id) on delete set null,
  learned_at_story_time text check(length(learned_at_story_time) between 1 and 100),
  chunk_id              uuid not null,
  quote                 text not null check(length(quote) between 5 and 1000),
  status                text not null default 'PROPOSED'
                          check(status in ('PROPOSED','CANON','RETRACTED','CONFLICTED')),
  revision              integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (chunk_id, project_id) references public.story_chunks(id, project_id) on delete cascade
);

-- 3. Timeline events: structured, story-time labeled, evidence-backed.
create table public.timeline_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null,
  chapter_id  uuid,
  story_time  text not null check(length(story_time) between 1 and 100),
  title       text not null check(length(title) between 1 and 300),
  description text not null default '' check(length(description) <= 1000),
  event_type  text not null default 'event'
                check(event_type in ('event','birth','death','discovery','meeting','conflict','reveal','other')),
  chunk_id    uuid not null,
  quote       text not null check(length(quote) between 5 and 1000),
  status      text not null default 'PROPOSED'
                check(status in ('PROPOSED','CANON','RETRACTED','CONFLICTED')),
  revision    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (chunk_id, project_id) references public.story_chunks(id, project_id) on delete cascade,
  foreign key (chapter_id, project_id) references public.chapters(id, project_id) on delete cascade
);

create index character_knowledge_project on public.character_knowledge(project_id, status);
create index timeline_events_project on public.timeline_events(project_id, status, story_time);

-- 4. RLS + revision triggers (same owner pattern as memory.sql; reuse advance_planning_revision).
do $$ declare t text; begin
 foreach t in array array['character_knowledge','timeline_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy memory_owner on public.%I for all to authenticated using (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))',t);
  execute format('create trigger advance_revision before update on public.%I for each row execute function public.advance_planning_revision()',t);
 end loop;
end $$;

-- 5. Extended save_memory_insights: facts gain SPO/confidence; optional events + knowledge.
--    Signature change (5th/6th params) => drop the old 4-arg function first.
--    Every quote must be a verbatim substring of the current chunk; events require story_time.
drop function if exists public.save_memory_insights(uuid,uuid,text,jsonb);
create function public.save_memory_insights(
  p_chunk_id uuid,p_generation_id uuid,p_summary text,p_facts jsonb,
  p_events jsonb default '[]',p_knowledge jsonb default '[]'
) returns void language plpgsql security invoker set search_path='' as $$
declare s public.story_chunks;c public.chapters;f jsonb;e jsonb;ch public.characters;
begin
 select * into s from public.story_chunks where id=p_chunk_id;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into c from public.chapters where id=s.chapter_id for share;
 if not found or c.revision_number<>s.source_revision or md5(c.plain_text)<>s.source_hash then raise exception 'STALE_SOURCE';end if;
 if not exists(select 1 from public.ai_generations where id=p_generation_id and project_id=s.project_id and user_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 insert into public.memory_insights(project_id,chunk_id,generation_id,summary) values(s.project_id,s.id,p_generation_id,p_summary) on conflict(chunk_id) do nothing;
 if not found then return;end if;
 for f in select value from jsonb_array_elements(p_facts) loop
  if length(f->>'claim') between 1 and 1000 and length(f->>'quote') between 5 and 1000 and strpos(s.content,f->>'quote')>0 then
   insert into public.story_facts(project_id,chunk_id,claim,quote,subject,predicate,object,source_chapter_id,confidence)
   values(s.project_id,s.id,f->>'claim',f->>'quote',
    nullif(left(f->>'subject',500),''),nullif(left(f->>'predicate',200),''),nullif(left(f->>'object',500),''),
    c.id,case when (f->>'confidence')~'^[0-9]+(\.[0-9]+)?$' then least(1,greatest(0,(f->>'confidence')::real)) end);
  end if;
 end loop;
 for e in select value from jsonb_array_elements(p_events) loop
  if length(e->>'title') between 1 and 300 and length(e->>'quote') between 5 and 1000
   and length(e->>'story_time') between 1 and 100 and strpos(s.content,e->>'quote')>0
   and (e->>'event_type') in ('event','birth','death','discovery','meeting','conflict','reveal','other') then
   insert into public.timeline_events(project_id,chapter_id,story_time,title,description,event_type,chunk_id,quote)
   values(s.project_id,c.id,left(e->>'story_time',100),left(e->>'title',300),left(coalesce(e->>'description',''),1000),e->>'event_type',s.id,e->>'quote');
  end if;
 end loop;
 for ch in select * from public.characters where project_id=s.project_id and deleted_at is null loop
  for e in select value from jsonb_array_elements(p_knowledge) loop
   if (e->>'character')=ch.name and length(e->>'statement') between 1 and 1000
    and length(e->>'quote') between 5 and 1000 and strpos(s.content,e->>'quote')>0 then
    insert into public.character_knowledge(project_id,character_id,fact_key,statement,knows,learned_at_chapter_id,learned_at_story_time,chunk_id,quote)
    values(s.project_id,ch.id,left(coalesce(nullif(e->>'fact_key',''),left(e->>'statement',200)),200),left(e->>'statement',1000),
     coalesce((e->>'knows')::boolean,true),c.id,nullif(left(e->>'story_time',100),''),s.id,e->>'quote');
   end if;
  end loop;
 end loop;
end $$;
revoke all on function public.save_memory_insights(uuid,uuid,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_memory_insights(uuid,uuid,text,jsonb,jsonb,jsonb) to authenticated;

-- 6. memory_overview gains timeline + knowledge sections (new signature; drop old first).
drop function if exists public.memory_overview(uuid);
create function public.memory_overview(p_project_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object(
 'jobs',coalesce((select jsonb_agg(x) from (select j.*,c.title,c.story_time from public.memory_jobs j join public.chapters c on c.id=j.chapter_id where j.project_id=p_project_id order by c.position) x),'[]'::jsonb),
 'chunks',coalesce((select jsonb_agg(x) from (select s.id,s.chapter_id,c.title,s.source_revision,s.chunk_index,(i.id is not null) analyzed from public.story_chunks s join public.chapters c on c.id=s.chapter_id left join public.memory_insights i on i.chunk_id=s.id where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) order by c.position,s.chunk_index limit 500) x),'[]'::jsonb),
 'insights',coalesce((select jsonb_agg(x) from (select i.id,i.chunk_id,i.summary,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.memory_insights i join public.story_chunks s on s.id=i.chunk_id join public.chapters c on c.id=s.chapter_id where i.project_id=p_project_id order by i.created_at desc limit 100) x),'[]'::jsonb),
 'facts',coalesce((select jsonb_agg(x) from (select f.*,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.story_facts f join public.story_chunks s on s.id=f.chunk_id join public.chapters c on c.id=s.chapter_id where f.project_id=p_project_id order by f.created_at desc limit 100) x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from (select e.*,s.chunk_index,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.timeline_events e join public.story_chunks s on s.id=e.chunk_id left join public.chapters c on c.id=e.chapter_id where e.project_id=p_project_id order by e.story_time,e.created_at desc limit 100) x),'[]'::jsonb),
 'knowledge',coalesce((select jsonb_agg(x) from (select k.*,ch.name character_name,ch.aliases,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.character_knowledge k join public.characters ch on ch.id=k.character_id join public.story_chunks s on s.id=k.chunk_id left join public.chapters c on c.id=s.chapter_id where k.project_id=p_project_id order by k.created_at desc limit 100) x),'[]'::jsonb)
 );
end $$;
revoke all on function public.memory_overview(uuid) from public;
grant execute on function public.memory_overview(uuid) to authenticated;

-- 7. Context-builder retrieval RPCs: revision-safe only (chunks must be current, jobs ready).
--    Events restricted to retrieved evidence chapters first, fall back to CANON events.
create function public.current_timeline_events(p_project_id uuid,p_preferred_chunk_ids uuid[])
returns table(id uuid,story_time text,title text,event_type text,chapter_id uuid,quote text,chunk_id uuid)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return query
 with safe as (
  select e.id,e.story_time,e.title,e.event_type,e.chapter_id,e.quote,e.chunk_id
  from public.timeline_events e
  join public.story_chunks s on s.id=e.chunk_id and s.project_id=e.project_id
  join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
  join public.memory_jobs j on j.chapter_id=c.id
  where e.project_id=p_project_id and e.status='CANON'
   and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) and j.status='ready'
 ),preferred as (
  select * from safe where chunk_id=any(p_preferred_chunk_ids)
 )
 select id,story_time,title,event_type,chapter_id,quote,chunk_id from preferred
 union all
 select id,story_time,title,event_type,chapter_id,quote,chunk_id from safe
 where chunk_id<>all(coalesce(p_preferred_chunk_ids,'{}'::uuid[]))
 order by story_time limit 20;
end $$;
revoke all on function public.current_timeline_events(uuid,uuid[]) from public;
grant execute on function public.current_timeline_events(uuid,uuid[]) to authenticated;

create function public.current_character_knowledge(p_project_id uuid,p_character_ids uuid[])
returns table(id uuid,character_id uuid,character_name text,statement text,knows boolean,learned_at_story_time text,quote text,chunk_id uuid)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 if p_character_ids is null or array_length(p_character_ids,1) is null then return;end if;
 return query
 select k.id,k.character_id,ch.name as character_name,k.statement,k.knows,k.learned_at_story_time,k.quote,k.chunk_id
 from public.character_knowledge k
 join public.characters ch on ch.id=k.character_id
 join public.story_chunks s on s.id=k.chunk_id and s.project_id=k.project_id
 join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
 join public.memory_jobs j on j.chapter_id=c.id
 where k.project_id=p_project_id and k.status='CANON' and k.character_id=any(p_character_ids)
  and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) and j.status='ready'
 order by k.learned_at_story_time limit 20;
end $$;
revoke all on function public.current_character_knowledge(uuid,uuid[]) from public;
grant execute on function public.current_character_knowledge(uuid,uuid[]) to authenticated;

-- 8. Review RPCs mirroring review_story_fact: owner-RLS implied by invoker + explicit checks,
--    approve only when the source chunk is still current, revision bump via trigger.
create function public.review_timeline_event(p_id uuid,p_revision integer,p_status text,p_title text) returns public.timeline_events
language plpgsql security invoker set search_path='' as $$
declare e public.timeline_events;s public.story_chunks;c public.chapters;
begin
 select * into e from public.timeline_events where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into s from public.story_chunks where id=e.chunk_id;
 select * into c from public.chapters where id=s.chapter_id for share;
 if p_status='CANON' and (c.revision_number<>s.source_revision or md5(c.plain_text)<>s.source_hash) then raise exception 'STALE_SOURCE';end if;
 update public.timeline_events set status=p_status,title=p_title where id=p_id and revision=p_revision returning * into e;
 if not found then raise exception 'REVISION_CONFLICT';end if;
 return e;
end $$;
revoke all on function public.review_timeline_event(uuid,integer,text,text) from public;
grant execute on function public.review_timeline_event(uuid,integer,text,text) to authenticated;

create function public.review_character_knowledge(p_id uuid,p_revision integer,p_status text,p_statement text) returns public.character_knowledge
language plpgsql security invoker set search_path='' as $$
declare k public.character_knowledge;s public.story_chunks;c public.chapters;
begin
 select * into k from public.character_knowledge where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into s from public.story_chunks where id=k.chunk_id;
 select * into c from public.chapters where id=s.chapter_id for share;
 if p_status='CANON' and (c.revision_number<>s.source_revision or md5(c.plain_text)<>s.source_hash) then raise exception 'STALE_SOURCE';end if;
 update public.character_knowledge set status=p_status,statement=p_statement where id=p_id and revision=p_revision returning * into k;
 if not found then raise exception 'REVISION_CONFLICT';end if;
 return k;
end $$;
revoke all on function public.review_character_knowledge(uuid,integer,text,text) from public;
grant execute on function public.review_character_knowledge(uuid,integer,text,text) to authenticated;
