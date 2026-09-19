-- Additive migration; existing projects, chapters and auth data are preserved.
create table public.characters (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 200), aliases text[] not null default '{}',
 role text not null default 'supporting',attributes jsonb not null default '{}',description text not null default '',
 include_in_ai_context boolean not null default true,
 revision integer not null default 0, deleted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.story_bibles (
 id uuid primary key default gen_random_uuid(), project_id uuid not null unique references public.projects(id) on delete cascade,
 premise text not null default '',synopsis text not null default '',themes text not null default '',
 tone text not null default '',style_instructions text not null default '',world_rules text not null default '',
 revision integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.notes (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),note_type text not null default 'general',plain_text text not null default '',
 include_in_ai_context boolean not null default false,
 revision integer not null default 0,deleted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.outline_items (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),description text not null default '',
 item_type text not null default 'chapter' check(item_type in ('act','part','chapter','scene','beat','custom')),
 status text not null default 'planned' check(status in ('planned','in_progress','drafted','revised','complete')),
 position integer not null default 0,chapter_id uuid,
 revision integer not null default 0,deleted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(chapter_id,project_id) references public.chapters(id,project_id) on delete set null (chapter_id)
);
create unique index outline_primary_chapter_idx on public.outline_items(chapter_id) where chapter_id is not null and deleted_at is null;
create index characters_project_idx on public.characters(project_id,created_at);
create index notes_project_idx on public.notes(project_id,created_at);
create index outline_project_position_idx on public.outline_items(project_id,position);
create function public.advance_planning_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.project_id<>old.project_id then raise exception 'PROJECT_CANNOT_CHANGE';end if;
 new.revision:=old.revision+1;new.updated_at:=now();return new;
end $$;
revoke all on function public.advance_planning_revision() from public;
do $$
declare t text;
begin
 foreach t in array array['characters','story_bibles','notes','outline_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create policy planning_owner on public.%I for all to authenticated using (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))',t);
 execute format('create trigger advance_revision before update on public.%I for each row execute function public.advance_planning_revision()',t);
 end loop;
end $$;
