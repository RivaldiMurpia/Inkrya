create function public.memory_overview(p_project_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object(
 'jobs',coalesce((select jsonb_agg(x) from (select j.*,c.title from public.memory_jobs j join public.chapters c on c.id=j.chapter_id where j.project_id=p_project_id order by c.position) x),'[]'::jsonb),
 'chunks',coalesce((select jsonb_agg(x) from (select s.id,s.chapter_id,c.title,s.source_revision,s.chunk_index,(i.id is not null) analyzed from public.story_chunks s join public.chapters c on c.id=s.chapter_id left join public.memory_insights i on i.chunk_id=s.id where s.project_id=p_project_id and s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text) order by c.position,s.chunk_index limit 500) x),'[]'::jsonb),
 'insights',coalesce((select jsonb_agg(x) from (select i.id,i.chunk_id,i.summary,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.memory_insights i join public.story_chunks s on s.id=i.chunk_id join public.chapters c on c.id=s.chapter_id where i.project_id=p_project_id order by i.created_at desc limit 100) x),'[]'::jsonb),
 'facts',coalesce((select jsonb_agg(x) from (select f.*,c.title,s.chunk_index,s.source_revision,(s.source_revision=c.revision_number and s.source_hash=md5(c.plain_text)) current from public.story_facts f join public.story_chunks s on s.id=f.chunk_id join public.chapters c on c.id=s.chapter_id where f.project_id=p_project_id order by f.created_at desc limit 100) x),'[]'::jsonb)
 );
end $$;
revoke all on function public.memory_overview(uuid) from public;
grant execute on function public.memory_overview(uuid) to authenticated;
create function public.review_story_fact(p_id uuid,p_revision integer,p_status text,p_claim text) returns public.story_facts language plpgsql security invoker set search_path='' as $$
declare f public.story_facts;s public.story_chunks;c public.chapters;
begin
 select * into f from public.story_facts where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into s from public.story_chunks where id=f.chunk_id;
 select * into c from public.chapters where id=s.chapter_id for share;
 if p_status='approved' and (c.revision_number<>s.source_revision or md5(c.plain_text)<>s.source_hash) then raise exception 'STALE_SOURCE';end if;
 update public.story_facts set status=p_status,claim=p_claim where id=p_id and revision=p_revision returning * into f;
 if not found then raise exception 'REVISION_CONFLICT';end if;
 return f;
end $$;
revoke all on function public.review_story_fact(uuid,integer,text,text) from public;
grant execute on function public.review_story_fact(uuid,integer,text,text) to authenticated;
