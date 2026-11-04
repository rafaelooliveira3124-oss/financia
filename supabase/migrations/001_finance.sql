-- Execute no SQL Editor de um projeto Supabase novo.
create or replace function public.valid_finance_state(s jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare e jsonb; i jsonb; c jsonb; ids text[] := '{}'; investment_ids text[] := '{}'; current_value bigint;
begin
 if s is null or exists(select 1 from jsonb_each(s) kv where kv.value='null'::jsonb) then return false; end if;
 if jsonb_typeof(s) <> 'object' or not (s ?& array['opening','entries','investments','categories']) then return false; end if;
 if jsonb_typeof(s->'opening') <> 'number' or (s->>'opening') !~ '^-?[0-9]+$' or abs((s->>'opening')::numeric)>100000000000000 then return false; end if;
 if jsonb_typeof(s->'entries')<>'array' or jsonb_typeof(s->'investments')<>'array' or jsonb_array_length(s->'entries')>50000 or jsonb_array_length(s->'investments')>1000 then return false; end if;
 for i in select * from jsonb_array_elements(s->'investments') loop
  if jsonb_typeof(i)<>'object' or exists(select 1 from jsonb_each(i) kv where kv.value='null'::jsonb) then return false; end if;
  if jsonb_typeof(i->'principal')<>'number' or jsonb_typeof(i->'current')<>'number' then return false; end if;
  if exists(select 1 from jsonb_each(i) kv where kv.key in ('id','name','type','institution','date') and jsonb_typeof(kv.value)<>'string') then return false; end if;
  if not (i ?& array['id','name','type','institution','principal','current','date']) or length(i->>'id')=0 or (i->>'id')=any(investment_ids) or length(i->>'name') not between 1 and 100 or length(i->>'institution') not between 1 and 100 then return false; end if;
  if (i->>'type') not in ('Tesouro Direto','CDB','LCI/LCA','Ações','Fundos Imobiliários','ETFs','Outros') or (i->>'principal') !~ '^[0-9]+$' or (i->>'current') !~ '^[0-9]+$' or (i->>'principal')::numeric>100000000000000 or (i->>'current')::numeric>100000000000000 or (i->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform (i->>'date')::date; investment_ids := array_append(investment_ids,i->>'id');
 end loop;
 for e in select * from jsonb_array_elements(s->'entries') loop
  if jsonb_typeof(e)<>'object' or exists(select 1 from jsonb_each(e) kv where kv.value='null'::jsonb) or jsonb_typeof(e->'amount')<>'number' then return false; end if;
  if exists(select 1 from jsonb_each(e) kv where kv.key in ('id','kind','description','category','date','notes','investmentId') and jsonb_typeof(kv.value)<>'string') then return false; end if;
  if not (e ?& array['id','kind','description','amount','category','date','notes']) or length(e->>'id')=0 or (e->>'id')=any(ids) or length(e->>'description') not between 1 and 120 or length(e->>'notes')>1000 or length(e->>'category') not between 1 and 100 then return false; end if;
  if (e->>'kind') not in ('income','expense','contribution','withdrawal','adjustment','valuation') or (e->>'amount') !~ '^-?[0-9]+$' or abs((e->>'amount')::numeric)>100000000000000 or (e->>'amount')::numeric=0 then return false; end if;
  if (e->>'kind') not in ('adjustment','valuation') and (e->>'amount')::numeric<0 then return false; end if;
  if (e->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if; perform (e->>'date')::date;
  if (e->>'kind') in ('contribution','withdrawal','valuation') then
   if not(e ? 'investmentId') or not((e->>'investmentId')=any(investment_ids)) then return false; end if;
  elsif e ? 'investmentId' then return false; end if;
  ids := array_append(ids,e->>'id');
 end loop;
 for i in select * from jsonb_array_elements(s->'investments') loop
  select (i->>'current')::bigint + coalesce(sum(case e->>'kind' when 'withdrawal' then -(e->>'amount')::bigint when 'contribution' then (e->>'amount')::bigint when 'valuation' then (e->>'amount')::bigint else 0 end),0) into current_value from jsonb_array_elements(s->'entries') e where e->>'investmentId'=i->>'id';
  if current_value<0 then return false; end if;
 end loop;
 if jsonb_typeof(s->'categories')<>'object' or not((s->'categories') ?& array['income','expense']) then return false; end if;
 foreach ids slice 1 in array array[array['income'],array['expense']] loop
  if jsonb_typeof(s->'categories'->ids[1])<>'array' then return false; end if;
  for c in select * from jsonb_array_elements(s->'categories'->ids[1]) loop
   if jsonb_typeof(c)<>'string' or length(c #>> '{}') not between 1 and 60 then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.finance_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (public.valid_finance_state(data)),
 updated_at timestamptz not null default now(),
 version integer not null default 1
);
alter table public.finance_states enable row level security;
create policy "Somente o titular lê" on public.finance_states for select to authenticated using ((select auth.uid())=user_id);
create policy "Somente o titular cria" on public.finance_states for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Somente o titular altera" on public.finance_states for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Somente o titular exclui" on public.finance_states for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.finance_states from anon;
grant select,insert,update,delete on public.finance_states to authenticated;

-- Escrita transacional com controle de concorrência; auth.uid é sempre da sessão.
create or replace function public.save_finance_state(next_data jsonb, expected_version integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if not public.valid_finance_state(next_data) then raise exception 'Dados inválidos. Revise os lançamentos.'; end if;
 if expected_version=0 then
  insert into public.finance_states(user_id,data,version) values(auth.uid(),next_data,1)
  on conflict(user_id) do nothing returning version into result;
 else
  update public.finance_states set data=next_data, version=version+1, updated_at=now()
  where user_id=auth.uid() and version=expected_version returning version into result;
 end if;
 if result is null then raise exception 'Seus dados foram alterados em outra aba. Recarregue a página antes de salvar.'; end if;
 return result;
end $$;
revoke all on function public.save_finance_state(jsonb,integer) from public,anon;
grant execute on function public.save_finance_state(jsonb,integer) to authenticated;
