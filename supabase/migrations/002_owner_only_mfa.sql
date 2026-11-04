-- Execute após 001_finance.sql. Ninguém tem acesso até autorizar o titular.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.financia_owner (
 singleton boolean primary key default true check (singleton),
 user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.financia_owner enable row level security;
revoke all on private.financia_owner from public, anon, authenticated;

create function private.is_finance_owner() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from private.financia_owner o
  join auth.users u on u.id=o.user_id
  where o.user_id=(select auth.uid()) and u.email_confirmed_at is not null
 );
$$;
revoke all on function private.is_finance_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_finance_owner() to authenticated;

-- O endpoint público não tem privilégios administrativos.
create function public.is_finance_owner() returns boolean
language sql stable security invoker set search_path = '' as $$
 select private.is_finance_owner();
$$;
revoke all on function public.is_finance_owner() from public, anon;
grant execute on function public.is_finance_owner() to authenticated;

-- A política restritiva é combinada com TODAS as permissivas existentes por AND.
create policy "Titular exclusivo com segundo fator" on public.finance_states
as restrictive for all to authenticated
using ((select public.is_finance_owner()) and (select auth.jwt()->>'aal')='aal2')
with check ((select public.is_finance_owner()) and (select auth.jwt()->>'aal')='aal2');

-- Mantenha o RPC como security invoker: a mesma RLS vale para a função e API.
alter function public.save_finance_state(jsonb,integer) security invoker;
commit;
