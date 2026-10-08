-- Phase 7: Tavily Research — extend ai_generations.action with 'research'.
-- One research run = one ai_generations row = one LLM quota slot, same convention as the
-- doctor action. Tavily credits are metered separately (they ride the same row's
-- token_usage, but the credit math in lib/research-budget.ts never touches the LLM quota).
-- The action CHECK is auto-named; discover it rather than hardcoding the name. One-time
-- via apply_migration; never reapply. NOTE: the credit-usage RPC for this phase is
-- APPENDED to this file later in the phase, so fresh databases receive the whole file in
-- one run while the live project receives it as two sequential migrations.
do $$
declare c text;
begin
 select conname into c from pg_constraint
  where conrelid='public.ai_generations'::regclass and contype='c'
   and position('doctor' in pg_get_constraintdef(oid))>0
  limit 1;
 if c is null then raise exception 'ACTION_CHECK_CONSTRAINT_NOT_FOUND';end if;
 execute format('alter table public.ai_generations drop constraint %I',c);
 execute format('alter table public.ai_generations add constraint ai_generations_action_check check(action in (%L,%L,%L,%L,%L,%L,%L))','chat','rewrite','continue','brainstorm','write','doctor','research');
end $$;

-- Phase 7 (part 2): the research credit meter. Tavily credits ride the same ai_generations
-- row's token_usage (key "tavily_credits") but are a separate meter from the LLM quota:
-- this RPC sums them, not row counts. SECURITY DEFINER because the global monthly figure
-- must be readable by the caller without exposing other users' rows through RLS.
create or replace function public.research_credit_usage(p_project_id uuid)
returns table (user_credits_24h bigint, global_credits_month bigint)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if not exists(
  select 1 from public.projects p
  where p.id = p_project_id and p.owner_id = auth.uid()
 ) then raise exception 'FORBIDDEN';end if;
 return query
 select
  coalesce(sum((g.token_usage->>'tavily_credits')::bigint),0)::bigint,
  coalesce(sum((g.token_usage->>'tavily_credits')::bigint),0)::bigint
 from public.ai_generations g
 where g.action = 'research'
  and (
   (g.user_id = auth.uid() and g.created_at > now() - interval '24 hours')
   or g.created_at >= date_trunc('month', now())
  );
end $$;
revoke execute on function public.research_credit_usage(uuid) from anon, public;
grant execute on function public.research_credit_usage(uuid) to authenticated;
