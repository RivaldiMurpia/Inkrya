-- Phase 3: hybrid retrieval returning chapter story_time.
-- Apply AFTER database/memory-phase3.sql.
-- Dropping both exact signatures before recreation is required by PostgreSQL
-- whenever the return row type changes. Neither signature uses DEFAULT arguments
-- so PostgREST resolves the 2-arg and 3-arg endpoints without HTTP 300 ambiguity.

drop function if exists public.retrieve_memory(uuid,text,public.vector);
drop function if exists public.retrieve_memory(uuid,text);

create function public.retrieve_memory(
  p_project_id uuid,
  p_query text,
  p_embedding vector(4096)
)
returns table(id uuid,chapter_id uuid,title text,story_time text,source_revision bigint,chunk_index integer,content text,score real)
language plpgsql stable security invoker set search_path='' as $$
declare query tsquery;words text;
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 if length(p_query)>2000 then raise exception 'QUERY_TOO_LONG';end if;

 select string_agg(quote_literal(word), ' | ') into words
 from (select distinct lower(w) word from regexp_split_to_table(p_query,'[^[:alnum:]]+') w
 where length(w)>2 and lower(w)<>all(array['apa','siapa','kapan','dimana','mana','bagaimana','mengapa','kenapa','yang','dan','atau','dengan','untuk','dari','pada','dalam','adalah','itu','ini','pernah','tentang','the','what','where','when','does','and','was','said','did']) limit 20) tokens;
 if words is not null then query:=to_tsquery('simple',words);end if;

 return query with
 lexical as (
  select s.id,row_number() over(order by ts_rank_cd(s.search_document,query)+coalesce(f.rank,0) desc,c.position,s.chunk_index) as rn
  from public.story_chunks s
  join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
  join public.memory_jobs j on j.chapter_id=c.id
  left join lateral (
   select max(ts_rank_cd(to_tsvector('simple',sf.claim),query)) as rank
   from public.story_facts sf
   where sf.chunk_id=s.id and sf.project_id=s.project_id and sf.status in ('approved','CANON')
   and strpos(s.content,sf.quote)>0 and to_tsvector('simple',sf.claim)@@query
  ) f on true
  where words is not null and s.project_id=p_project_id and s.source_revision=c.revision_number
   and s.source_hash=md5(c.plain_text) and j.status='ready'
   and (s.search_document@@query or f.rank is not null)
  limit 20
 ),
 semantic as (
  select e.chunk_id as id,row_number() over(order by e.embedding OPERATOR(public.<=>) p_embedding) as rn
  from public.story_embeddings e
  join public.story_chunks s on s.id=e.chunk_id and s.project_id=e.project_id
  join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
  join public.memory_jobs j on j.chapter_id=c.id
  where p_embedding is not null and e.project_id=p_project_id
   and e.source_revision=c.revision_number and e.source_hash=md5(c.plain_text)
   and s.source_revision=e.source_revision and s.source_hash=e.source_hash and j.status='ready'
  limit 20
 ),
 merged as (
  select coalesce(l.id,s.id) as id,
   (coalesce(1.0/(60+l.rn),0)+coalesce(1.0/(60+s.rn),0))::real as rrf_score
  from lexical l full outer join semantic s on s.id=l.id
 )
 select sc.id,sc.chapter_id,c.title,c.story_time,sc.source_revision,sc.chunk_index,sc.content,m.rrf_score
 from merged m join public.story_chunks sc on sc.id=m.id
 join public.chapters c on c.id=sc.chapter_id and c.project_id=sc.project_id
 order by m.rrf_score desc,c.position,sc.chunk_index limit 8;
end $$;

revoke all on function public.retrieve_memory(uuid,text,public.vector) from public;
grant execute on function public.retrieve_memory(uuid,text,public.vector) to authenticated;

-- Legacy 2-arg: fallback when caller provides no vector. Also returns story_time.
create function public.retrieve_memory(p_project_id uuid,p_query text)
returns table(id uuid,chapter_id uuid,title text,story_time text,source_revision bigint,chunk_index integer,content text,score real)
language plpgsql stable security invoker set search_path='' as $$
declare query tsquery;words text;
begin
 if auth.uid() is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 if length(p_query)>2000 then raise exception 'QUERY_TOO_LONG';end if;
 select string_agg(quote_literal(word), ' | ') into words from (select distinct lower(w) word from regexp_split_to_table(p_query,'[^[:alnum:]]+') w
 where length(w)>2 and lower(w)<>all(array['apa','siapa','kapan','dimana','mana','bagaimana','mengapa','kenapa','yang','dan','atau','dengan','untuk','dari','pada','dalam','adalah','itu','ini','pernah','tentang','the','what','where','when','does','and','was','said','did']) limit 20) tokens;
 if words is null then return;end if;
 query:=to_tsquery('simple',words);
 return query select s.id,s.chapter_id,c.title,c.story_time,s.source_revision,s.chunk_index,s.content,(ts_rank_cd(s.search_document,query)+coalesce(f.rank,0))::real as score
 from public.story_chunks s join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
 join public.memory_jobs j on j.chapter_id=c.id
 left join lateral (
 select max(ts_rank_cd(to_tsvector('simple',sf.claim),query)) as rank
 from public.story_facts sf
 where sf.chunk_id=s.id and sf.project_id=s.project_id and sf.status in ('approved','CANON')
 and strpos(s.content,sf.quote)>0 and to_tsvector('simple',sf.claim)@@query
 ) f on true
 where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) and j.status='ready' and (s.search_document@@query or f.rank is not null)
 order by score desc,c.position,s.chunk_index limit 8;
end $$;

revoke all on function public.retrieve_memory(uuid,text) from public;
grant execute on function public.retrieve_memory(uuid,text) to authenticated;
