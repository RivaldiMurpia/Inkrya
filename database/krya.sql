create table public.ai_generations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 project_id uuid references public.projects(id) on delete set null,
 action text not null check(action in ('chat','rewrite','continue','brainstorm')),
 prompt text not null check(length(prompt)<=6000), result text not null default '',
 model text not null, status text not null default 'pending' check(status in ('pending','complete','error')),
 context_sources jsonb not null default '[]', token_usage jsonb, estimated_cost_usd numeric,
 created_at timestamptz not null default now()
);
alter table public.ai_generations enable row level security;
revoke all on public.ai_generations from anon,authenticated;
grant select,insert on public.ai_generations to authenticated;
grant update(result,status,token_usage,estimated_cost_usd) on public.ai_generations to authenticated;
create policy own_generations on public.ai_generations for select to authenticated using(user_id=(select auth.uid()));
create policy insert_generation on public.ai_generations for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy update_generation on public.ai_generations for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index ai_generations_user_time on public.ai_generations(user_id,created_at desc);
create index ai_generations_project_time on public.ai_generations(project_id,created_at desc);
create function public.limit_ai_generation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'UNAUTHORIZED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,17));
 new.created_at:=now();
 if (select count(*) from public.ai_generations where user_id=auth.uid() and created_at>now()-interval '24 hours')>=20 then raise exception 'AI_DAILY_LIMIT';end if;
 if exists(select 1 from public.ai_generations where user_id=auth.uid() and created_at>now()-interval '10 seconds') then raise exception 'AI_RATE_LIMIT';end if;
 return new;
end $$;
revoke all on function public.limit_ai_generation() from public;
create trigger limit_ai_generation before insert on public.ai_generations for each row execute function public.limit_ai_generation();
