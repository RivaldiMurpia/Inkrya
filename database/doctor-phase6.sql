-- Phase 6: Story Doctor — extend ai_generations.action with 'doctor'.
-- One doctor run = one ai_generations row = one quota slot (limit_ai_generation counts rows,
-- no other schema change). Findings live in ai_generations.result — no new table, the
-- report is re-derivable by running the doctor again (stateless by design).
-- The action CHECK is inline in database/krya.sql:4 (auto-named); discover it rather than
-- hardcoding the name. One-time via apply_migration; never reapply.
do $$
declare c text;
begin
 select conname into c from pg_constraint
  where conrelid='public.ai_generations'::regclass and contype='c'
   and position('brainstorm' in pg_get_constraintdef(oid))>0
  limit 1;
 if c is null then raise exception 'ACTION_CHECK_CONSTRAINT_NOT_FOUND';end if;
 execute format('alter table public.ai_generations drop constraint %I',c);
 execute format('alter table public.ai_generations add constraint ai_generations_action_check check(action in (%L,%L,%L,%L,%L,%L))','chat','rewrite','continue','brainstorm','write','doctor');
end $$;
