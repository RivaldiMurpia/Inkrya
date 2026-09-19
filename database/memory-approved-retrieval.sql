create or replace function public.retrieve_memory(p_project_id uuid,p_query text)
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
 return query select s.id,s.chapter_id,c.title,s.source_revision,s.chunk_index,s.content,(ts_rank_cd(s.search_document,query)+coalesce(f.rank,0))::real as score
 from public.story_chunks s join public.chapters c on c.id=s.chapter_id and c.project_id=s.project_id
 join public.memory_jobs j on j.chapter_id=c.id
 left join lateral (
 select max(ts_rank_cd(to_tsvector('simple',sf.claim),query)) as rank
 from public.story_facts sf
 where sf.chunk_id=s.id and sf.project_id=s.project_id and sf.status='approved'
 and strpos(s.content,sf.quote)>0 and to_tsvector('simple',sf.claim)@@query
 ) f on true
 where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) and j.status='ready' and (s.search_document@@query or f.rank is not null)
 order by score desc,c.position,s.chunk_index limit 8;
end $$;

