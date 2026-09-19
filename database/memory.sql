-- Revision-safe lexical memory. Semantic embeddings require a separate provider decision.
create table public.memory_jobs (
 chapter_id uuid primary key,project_id uuid not null,source_revision bigint not null,source_hash text not null,
 status text not null default 'queued' check(status in ('queued','ready','failed')),
 attempts integer not null default 0,available_at timestamptz not null default now(),error text,
 updated_at timestamptz not null default now(),
 foreign key(chapter_id,project_id) references public.chapters(id,project_id) on delete cascade
);
create table public.story_chunks (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,chapter_id uuid not null,
 source_revision bigint not null,source_hash text not null,chunk_index integer not null,
 start_offset integer not null,end_offset integer not null,content text not null,
 content_hash text generated always as (md5(content)) stored,
 search_document tsvector generated always as (to_tsvector('simple',content)) stored,
 created_at timestamptz not null default now(),
 foreign key(chapter_id,project_id) references public.chapters(id,project_id) on delete cascade,
 unique(chapter_id,source_revision,source_hash,chunk_index),unique(id,project_id)
);
create table public.memory_insights (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,chunk_id uuid not null,
 generation_id uuid references public.ai_generations(id) on delete set null,
 summary text not null,created_at timestamptz not null default now(),
 foreign key(chunk_id,project_id) references public.story_chunks(id,project_id) on delete cascade,
 unique(chunk_id)
);
create table public.story_facts (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,chunk_id uuid not null,
 claim text not null,quote text not null,status text not null default 'pending' check(status in ('pending','approved','ignored')),
 revision integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(chunk_id,project_id) references public.story_chunks(id,project_id) on delete cascade,
 check(length(claim) between 1 and 1000),check(length(quote) between 1 and 1000)
);
create index memory_jobs_project on public.memory_jobs(project_id,status,available_at);
create index story_chunks_project on public.story_chunks(project_id,chapter_id,source_revision);
create index story_chunks_fts on public.story_chunks using gin(search_document);
create index memory_insights_project on public.memory_insights(project_id);
create index story_facts_project on public.story_facts(project_id,status);
do $$ declare t text;begin foreach t in array array['memory_jobs','story_chunks','memory_insights','story_facts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy memory_owner on public.%I for all to authenticated using (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))',t);
end loop;end $$;
create function public.queue_chapter_memory() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.memory_jobs(chapter_id,project_id,source_revision,source_hash,status,available_at)
 values(new.id,new.project_id,new.revision_number,md5(new.plain_text),'queued',now()+interval '45 seconds')
 on conflict(chapter_id) do update set source_revision=excluded.source_revision,source_hash=excluded.source_hash,status='queued',attempts=0,error=null,available_at=excluded.available_at,updated_at=now();
 return new;
end $$;
revoke all on function public.queue_chapter_memory() from public;
create trigger queue_chapter_memory after insert or update of plain_text,revision_number on public.chapters for each row execute function public.queue_chapter_memory();
insert into public.memory_jobs(chapter_id,project_id,source_revision,source_hash) select id,project_id,revision_number,md5(plain_text) from public.chapters;

create function public.process_memory(p_project_id uuid,p_force boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.memory_jobs;c public.chapters;at integer:=1;finish integer;cut integer;seq integer:=0;total integer;
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 -- Take chapter lock before job lock, matching save_chapter -> queue trigger order.
 select ch.* into c from public.chapters ch join public.memory_jobs mj on mj.chapter_id=ch.id
 where ch.project_id=p_project_id and mj.status in ('queued','failed') and mj.attempts<3 and (p_force or mj.available_at<=now())
 order by ch.position,ch.id limit 1 for update of ch skip locked;
 if not found then return jsonb_build_object('processed',false);end if;
 select * into j from public.memory_jobs where chapter_id=c.id for update;
 begin
 total:=length(c.plain_text);
 while at<=total loop
 finish:=least(at+3199,total);
 if finish<total then
 -- Prefer last paragraph/sentence/space in the final quarter of the window.
 select length((regexp_match(substring(c.plain_text from greatest(at,finish-700) for 701), E'(?s)^(.*)[\\n.!? ]'))[1]) into cut;
 if cut is not null then finish:=greatest(at,finish-700)+cut;end if;
 end if;
 if length(btrim(substring(c.plain_text from at for finish-at+1)))>0 then
 insert into public.story_chunks(project_id,chapter_id,source_revision,source_hash,chunk_index,start_offset,end_offset,content)
 values(c.project_id,c.id,c.revision_number,md5(c.plain_text),seq,at-1,finish,substring(c.plain_text from at for finish-at+1)) on conflict do nothing;
 seq:=seq+1;
 end if;
 exit when finish>=total;
 at:=greatest(at+1,finish-319);
 end loop;
 update public.memory_jobs set source_revision=c.revision_number,source_hash=md5(c.plain_text),status='ready',error=null,updated_at=now() where chapter_id=c.id;
 return jsonb_build_object('processed',true,'chapter_id',c.id,'chunks',seq);
 exception when others then
 update public.memory_jobs set status='failed',attempts=attempts+1,error='INDEX_FAILED',available_at=now()+interval '30 seconds'*power(2,attempts),updated_at=now() where chapter_id=c.id;
 return jsonb_build_object('processed',false,'error','INDEX_FAILED');
 end;
end $$;
revoke all on function public.process_memory(uuid,boolean) from public;
grant execute on function public.process_memory(uuid,boolean) to authenticated;

create function public.retrieve_memory(p_project_id uuid,p_query text)
returns table(id uuid,chapter_id uuid,title text,source_revision bigint,chunk_index integer,content text,score real)
language plpgsql stable security invoker set search_path='' as $$
declare query tsquery;words text;
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 if length(p_query)>2000 then raise exception 'QUERY_TOO_LONG';end if;
 select string_agg(quote_literal(word), ' | ') into words from (select distinct lower(w) word from regexp_split_to_table(p_query,'[^[:alnum:]]+') w
 where length(w)>2 and lower(w)<>all(array['apa','siapa','kapan','dimana','mana','bagaimana','mengapa','kenapa','yang','dan','atau','dengan','untuk','dari','pada','dalam','adalah','itu','ini','pernah','tentang','the','what','where','when','does','and','was','said','did']) limit 20) tokens;
 if words is null then return;end if;
 query:=to_tsquery('simple',words);
 return query select s.id,s.chapter_id,c.title,s.source_revision,s.chunk_index,s.content,ts_rank_cd(s.search_document,query) as score
 from public.story_chunks s join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
 join public.memory_jobs j on j.chapter_id=c.id
 where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) and j.status='ready' and s.search_document@@query
 order by ts_rank_cd(s.search_document,query) desc,c.position,s.chunk_index limit 8;
end $$;
revoke all on function public.retrieve_memory(uuid,text) from public;
grant execute on function public.retrieve_memory(uuid,text) to authenticated;

create function public.save_memory_insights(p_chunk_id uuid,p_generation_id uuid,p_summary text,p_facts jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare s public.story_chunks;c public.chapters;f jsonb;
begin
 select * into s from public.story_chunks where id=p_chunk_id;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into c from public.chapters where id=s.chapter_id for share;
 if not found or c.revision_number<>s.source_revision or md5(c.plain_text)<>s.source_hash then raise exception 'STALE_SOURCE';end if;
 if not exists(select 1 from public.ai_generations where id=p_generation_id and project_id=s.project_id and user_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 if length(p_summary)>3000 or jsonb_typeof(p_facts)<>'array' or jsonb_array_length(p_facts)>8 then raise exception 'INVALID_INSIGHTS';end if;
 insert into public.memory_insights(project_id,chunk_id,generation_id,summary) values(s.project_id,s.id,p_generation_id,p_summary) on conflict(chunk_id) do nothing;
 if not found then return;end if;
 for f in select value from jsonb_array_elements(p_facts) loop
 if length(f->>'claim') between 1 and 1000 and length(f->>'quote') between 1 and 1000 and strpos(s.content,f->>'quote')>0 then
 insert into public.story_facts(project_id,chunk_id,claim,quote) values(s.project_id,s.id,f->>'claim',f->>'quote');
 end if;
 end loop;
end $$;
revoke all on function public.save_memory_insights(uuid,uuid,text,jsonb) from public;
grant execute on function public.save_memory_insights(uuid,uuid,text,jsonb) to authenticated;
create trigger fact_revision before update on public.story_facts for each row execute function public.advance_planning_revision();
