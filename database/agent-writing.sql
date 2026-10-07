-- Phase 4: Agentic Writing — extend ai_generations.action with 'write'.
-- One write request = one ai_generations row = one quota slot (existing limit_ai_generation
-- trigger counts rows, so per-request quota needs no other schema change).
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
 execute format('alter table public.ai_generations add constraint ai_generations_action_check check(action in (%L,%L,%L,%L,%L))','chat','rewrite','continue','brainstorm','write');
end $$;
