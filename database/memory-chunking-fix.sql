create or replace function public.process_memory(p_project_id uuid,p_force boolean default false) returns jsonb
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
