-- Test-account quota exemption. Auditable + revocable: the exemption lives in one table row
-- keyed by email, NOT hardcoded in application code. Adding an email here lifts BOTH the
-- 20/24h daily limit and the 10-second minimum interval for that account only.
--
-- SECURITY: this is a standing bypass of the per-user quota. Anyone holding the account's
-- credentials can run unmetered inference against the project's Nebius credits. It is
-- granted ONLY for automated testing accounts; revoke by deleting the row. The table is
-- readable/writable by no client role — only the SECURITY DEFINER trigger reads it.
-- One-time via apply_migration; never reapply.

create table if not exists public.quota_exempt_accounts (
  email      text primary key check(length(btrim(email)) between 3 and 320),
  reason     text not null default '' check(length(reason) <= 500),
  created_at timestamptz not null default now()
);
alter table public.quota_exempt_accounts enable row level security;
revoke all on public.quota_exempt_accounts from anon, authenticated;
-- No policies: the table is invisible to client roles. The quota trigger is SECURITY DEFINER
-- and reads it with the function owner's rights.

-- Replace the quota trigger function: same behavior, plus an email exemption lookup. The
-- email is read from auth.users for the current uid; a missing/blank email is never exempt.
create or replace function public.limit_ai_generation() returns trigger
language plpgsql security definer set search_path='' as $$
declare exempt boolean;
begin
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'UNAUTHORIZED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,17));
 new.created_at:=now();
 select exists(
  select 1 from public.quota_exempt_accounts q
  join auth.users u on lower(u.email)=q.email
  where u.id=auth.uid()
 ) into exempt;
 if exempt then return new;end if;
 if (select count(*) from public.ai_generations where user_id=auth.uid() and created_at>now()-interval '24 hours')>=20 then raise exception 'AI_DAILY_LIMIT';end if;
 if exists(select 1 from public.ai_generations where user_id=auth.uid() and created_at>now()-interval '10 seconds') then raise exception 'AI_RATE_LIMIT';end if;
 return new;
end $$;
-- Supabase grants EXECUTE to anon/authenticated/service_role at create time; `revoke from
-- public` alone never lifts those explicit grants. authenticated keeps EXECUTE (the insert
-- runs under the user's JWT); anon loses it — anonymous clients must never touch quota.
revoke execute on function public.limit_ai_generation() from anon;
revoke all on function public.limit_ai_generation() from public;
