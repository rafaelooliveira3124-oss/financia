-- NÃO EXECUTE AS MIGRAÇÕES DE NOVO: use este arquivo após criar seu usuário.
-- Substitua o UUID abaixo pelo User UID em Authentication > Users.
-- Execute apenas no SQL Editor administrativo do Supabase.
-- Não use seu e-mail ou uma senha neste arquivo e não envie valores reais ao GitHub.
begin;
insert into private.financia_owner(singleton,user_id)
values (true,'SUBSTITUA-PELO-USER-UID'::uuid)
on conflict(singleton) do update set user_id=excluded.user_id;
commit;
