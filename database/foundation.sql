-- Reviewed foundation schema; apply through Supabase apply_migration after project linking.
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null default '', genre text not null default '',
 manuscript_language text not null default 'id',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index projects_owner_created_idx on public.projects(owner_id,created_at desc);
alter table public.projects enable row level security;
create policy project_owner on public.projects for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create table public.chapters (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 title text not null default 'Bab 1' check(length(title) between 1 and 200),
 content_json jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
 plain_text text not null default '', revision_number bigint not null default 0 check(revision_number>=0),
 position integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,project_id), check(jsonb_typeof(content_json)='object')
);
create index chapters_project_position_idx on public.chapters(project_id,position);
alter table public.chapters enable row level security;
create policy chapter_owner on public.chapters for all to authenticated
 using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create table public.chapter_versions (
 id uuid primary key default gen_random_uuid(), chapter_id uuid not null, project_id uuid not null,
 revision_number bigint not null, title text not null,content_json jsonb not null,plain_text text not null,
 created_at timestamptz not null default now(), unique(chapter_id,revision_number),
 foreign key(chapter_id,project_id) references public.chapters(id,project_id) on delete cascade
);
create index versions_project_idx on public.chapter_versions(project_id);
alter table public.chapter_versions enable row level security;
create policy versions_read on public.chapter_versions for select to authenticated
 using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy versions_insert on public.chapter_versions for insert to authenticated
 with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
revoke all on public.projects,public.chapters,public.chapter_versions from anon;
grant select,insert,update,delete on public.projects,public.chapters to authenticated;
revoke all on public.chapter_versions from authenticated;
grant select,insert on public.chapter_versions to authenticated;

create function public.create_story(p_title text,p_genre text) returns public.projects
language plpgsql security invoker set search_path='' as $$
declare p public.projects;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 insert into public.projects(title,genre) values(btrim(p_title),p_genre) returning * into p;
 insert into public.chapters(project_id) values(p.id);
 return p;
end $$;
revoke all on function public.create_story(text,text) from public;
grant execute on function public.create_story(text,text) to authenticated;

create function public.save_chapter(p_chapter_id uuid,p_base_revision bigint,p_title text,p_content jsonb,p_plain_text text)
returns public.chapters language plpgsql security invoker set search_path='' as $$
declare c public.chapters;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 select * into c from public.chapters where id=p_chapter_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if c.revision_number<>p_base_revision then raise exception 'REVISION_CONFLICT';end if;
 if octet_length(p_plain_text)>2000000 or octet_length(p_content::text)>4000000 then raise exception 'CHAPTER_TOO_LARGE';end if;
 if p_content->>'type' is distinct from 'doc' then raise exception 'INVALID_DOCUMENT';end if;
 insert into public.chapter_versions(chapter_id,project_id,revision_number,title,content_json,plain_text)
 values(c.id,c.project_id,c.revision_number,c.title,c.content_json,c.plain_text) on conflict(chapter_id,revision_number) do nothing;
 update public.chapters set title=p_title,content_json=p_content,plain_text=p_plain_text,
 revision_number=c.revision_number+1,updated_at=now() where id=c.id returning * into c;
 update public.projects set updated_at=now() where id=c.project_id;
 return c;
end $$;
revoke all on function public.save_chapter(uuid,bigint,text,jsonb,text) from public;
grant execute on function public.save_chapter(uuid,bigint,text,jsonb,text) to authenticated;
