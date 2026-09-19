-- Literal substring search: %, _ and SQL-like input are ordinary characters.
create function public.search_project(p_project_id uuid,p_query text,p_offset integer default 0)
returns table(source_type text,source_id uuid,title text,excerpt text)
language plpgsql stable security invoker set search_path='' as $$
declare q text:=lower(btrim(p_query));
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if q is null or length(q)<2 or length(q)>100 or p_offset<0 or p_offset>10000 then raise exception 'INVALID_SEARCH';end if;
 if not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'NOT_FOUND';end if;
 return query
 with documents as (
 select 'chapter'::text kind,c.id,c.title heading,c.title||E'\n'||c.plain_text body from public.chapters c where c.project_id=p_project_id
 union all
 select 'characters',c.id,c.name,concat_ws(E'\n',c.name,array_to_string(c.aliases,', '),c.role,c.description,c.attributes::text) from public.characters c where c.project_id=p_project_id and c.deleted_at is null
 union all
 select 'story_bibles',b.id,'Story Bible',concat_ws(E'\n',b.premise,b.synopsis,b.themes,b.tone,b.style_instructions,b.world_rules) from public.story_bibles b where b.project_id=p_project_id
 union all
 select 'notes',n.id,n.title,concat_ws(E'\n',n.title,n.note_type,n.plain_text) from public.notes n where n.project_id=p_project_id and n.deleted_at is null
 union all
 select 'outline_items',o.id,o.title,concat_ws(E'\n',o.title,o.description) from public.outline_items o where o.project_id=p_project_id and o.deleted_at is null
 ), matches as (select d.*,strpos(lower(d.body),q) hit from documents d)
 select m.kind,m.id,m.heading,
 (case when m.hit>60 then '…' else '' end)||substring(m.body from greatest(1,m.hit-60) for 260)||(case when length(m.body)>greatest(1,m.hit-60)+259 then '…' else '' end)
 from matches m where m.hit>0 order by m.kind,m.heading,m.id limit 21 offset p_offset;
end $$;
revoke all on function public.search_project(uuid,text,integer) from public;
grant execute on function public.search_project(uuid,text,integer) to authenticated;
