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
