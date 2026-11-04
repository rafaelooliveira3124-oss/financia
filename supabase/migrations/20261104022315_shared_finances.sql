-- Atualização de uma instalação existente. Não execute setup.sql novamente.
-- Preserva integralmente a linha financeira e a versão atuais do titular.
begin;
create table if not exists private.financia_members (
 singleton boolean primary key default true check (singleton),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 account_owner_id uuid not null references private.financia_owner(user_id) on delete cascade,
 check (user_id <> account_owner_id)
);
alter table private.financia_members enable row level security;
revoke all on private.financia_members from public, anon, authenticated;

-- Somente a resolução da autorização interna precisa dos privilégios do criador.
-- Nunca recebe UID do cliente e não consulta nem retorna valores financeiros.
create or replace function private.finance_account_id() returns uuid
language sql stable security definer set search_path = '' as $$
 select o.user_id
 from private.financia_owner o
 join auth.users owner_user on owner_user.id=o.user_id
 join auth.users caller_user on caller_user.id=(select auth.uid())
 where owner_user.email_confirmed_at is not null
   and caller_user.email_confirmed_at is not null
   and (
    o.user_id=(select auth.uid())
    or exists (
     select 1 from private.financia_members m
     where m.account_owner_id=o.user_id and m.user_id=(select auth.uid())
    )
   );
$$;
revoke all on function private.finance_account_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.finance_account_id() to authenticated;

-- Alias mantido para clientes antigos: significa acesso autorizado à carteira.
create or replace function private.is_finance_owner() returns boolean
language sql stable security invoker set search_path = '' as $$
 select private.finance_account_id() is not null;
$$;
revoke all on function private.is_finance_owner() from public, anon;
grant execute on function private.is_finance_owner() to authenticated;

drop policy if exists "Somente o titular lê" on public.finance_states;
drop policy if exists "Somente o titular cria" on public.finance_states;
drop policy if exists "Somente o titular altera" on public.finance_states;
drop policy if exists "Somente o titular exclui" on public.finance_states;
drop policy if exists "Titular exclusivo com segundo fator" on public.finance_states;
drop policy if exists "Carteira autorizada" on public.finance_states;
drop policy if exists "Carteira autorizada com segundo fator" on public.finance_states;
create policy "Carteira autorizada" on public.finance_states for all to authenticated
using (user_id=(select private.finance_account_id()))
with check (user_id=(select private.finance_account_id()));
create policy "Carteira autorizada com segundo fator" on public.finance_states
as restrictive for all to authenticated
using (user_id=(select private.finance_account_id()) and (select auth.jwt()->>'aal')='aal2')
with check (user_id=(select private.finance_account_id()) and (select auth.jwt()->>'aal')='aal2');

create or replace function public.save_finance_state(next_data jsonb,expected_version integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer; account_id uuid;
begin
 account_id:=private.finance_account_id();
 if account_id is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
  raise exception 'Acesso à carteira exige autorização e segundo fator.';
 end if;
 if not public.valid_finance_state(next_data) then
  raise exception 'Dados inválidos. Revise os lançamentos.';
 end if;
 if expected_version=0 then
  insert into public.finance_states(user_id,data,version) values(account_id,next_data,1)
  on conflict(user_id) do nothing returning version into result;
 else
  update public.finance_states set data=next_data,version=version+1,updated_at=now()
  where user_id=account_id and version=expected_version returning version into result;
 end if;
 if result is null then
  raise exception 'A carteira foi atualizada em outra sessão. Recarregue antes de salvar.';
 end if;
 return result;
end $$;
revoke all on function public.save_finance_state(jsonb,integer) from public,anon;
grant execute on function public.save_finance_state(jsonb,integer) to authenticated;
commit;
select 'Compartilhamento preparado. Autorize o segundo usuário pelo SQL administrativo.' as status;
