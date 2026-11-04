# Uma carteira, dois logins

Esta extensão mantém todos os saldos e movimentos na linha existente do titular. O segundo usuário não ganha uma cópia: os dois leem e gravam a mesma carteira. Cada pessoa mantém senha, sessão e autenticador próprios. Cadastro público continua desativado.

## Instalar numa conta já em uso

1. Não execute `setup.sql` novamente. Faça uma exportação de segurança pela conta do titular e guarde-a em local privado.
2. Execute `supabase/migrations/20261104022315_shared_finances.sql` no SQL Editor administrativo do Supabase. Essa migração não altera nem apaga a linha de dados financeiros existente.
3. Crie o login do segundo usuário em Authentication → Users, com senha escolhida por essa pessoa. Confirme o e-mail. Não compartilhe senhas ou fatores MFA.
4. Execute o bloco abaixo no SQL Editor, substituindo somente o UID. Ele permite exatamente um segundo usuário. Apenas o administrador do projeto pode conceder, trocar ou retirar esse acesso.

```sql
begin;
insert into private.financia_members (singleton, user_id, account_owner_id)
select true, u.id, o.user_id
from auth.users u
cross join private.financia_owner o
where u.id = 'COLE-AQUI-O-UID-DO-SEGUNDO-USUARIO'::uuid
  and u.email_confirmed_at is not null
  and u.id <> o.user_id
on conflict (singleton) do update
set user_id = excluded.user_id,
    account_owner_id = excluded.account_owner_id;
select user_id from private.financia_members;
commit;
```

Se não aparecer o UID desejado, confira se o usuário foi criado neste projeto e tem e-mail confirmado antes de continuar.

## Primeiro acesso e uso

O segundo usuário entra no mesmo endereço do site com seu próprio e-mail e senha. Ele precisa configurar e confirmar seu próprio autenticador. A autorização sem MFA não libera dados. Confiram os mesmos saldos e façam um lançamento fictício de teste antes de usar o compartilhamento diariamente.

Use o botão “Atualizar carteira” no topo, ou recarregue a página, para carregar mudanças feitas pelo outro acesso. Não há sincronização em tempo real. Se os dois editarem uma versão antiga, o banco recusa a segunda gravação; atualize e refaça a alteração para evitar sobrescrita silenciosa.

Ambos podem ver os saldos, exportar dados, cadastrar, editar e excluir movimentações, alterar o saldo inicial e gerenciar investimentos e categorias. Não há permissão somente de leitura nesta versão.

## Retirar o segundo acesso

No SQL Editor administrativo, execute:

```sql
delete from private.financia_members;
```

As próximas consultas e gravações desse usuário serão recusadas, mesmo se sua sessão ainda existir. O titular mantém o acesso e os dados. Retirar acesso não apaga informações que a pessoa já tenha visto ou exportado. Para revogar também a autenticação, encerre as sessões do usuário no painel do Supabase.

## Verificação

`src/shared-security.test.ts` testa a migração sobre uma carteira preexistente, acesso de ambos com MFA, recusa sem MFA, usuário não autorizado, chamadas diretas à tabela, tentativa de alterar a autorização, conflitos de versão e revogação. Os testes são locais em PostgreSQL embarcado. O teste com os dois logins de produção deve ser feito pelos próprios usuários.
