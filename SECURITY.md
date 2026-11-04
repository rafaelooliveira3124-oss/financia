# Acesso exclusivo do titular

**Extensão opcional:** para dois logins acessando a mesma carteira, siga `COMPARTILHAR.md`. A instalação inicial abaixo continua restrita a um titular; após a migração de compartilhamento, também é aceito o único segundo usuário autorizado pelo administrador, sempre com MFA. Essa extensão foi solicitada para uso compartilhado e concede leitura e alteração dos mesmos dados financeiros.

O código e a tela de entrada são públicos. Saldos e movimentações ficam no PostgreSQL e só são liberados pela API quando o usuário é o titular autorizado, tem e-mail confirmado e sessão com segundo fator (`aal2`). Alterar o JavaScript ou chamar a API diretamente não contorna essas regras. O proprietário administrativo do projeto Supabase também tem acesso ao banco: proteja essa conta com MFA e não compartilhe acesso administrativo.

## Ativação (projeto Supabase exclusivo para o Financia)

1. Em um projeto novo, execute `supabase/setup.sql` no SQL Editor. Esse arquivo reúne as duas migrações em uma transação. Execute uma única vez; não rode as migrações separadamente depois. Nenhuma conta acessa os dados até o titular ser autorizado.
2. Em Authentication → Users, crie sua própria conta com e-mail confirmado pelo fluxo do Supabase. Escolha sua senha no painel ou no link de convite. Não envie senhas no chat, em SQL, em arquivos ou em commits.
3. Copie o User UID da sua conta para o lugar indicado em `supabase/authorize-owner.sql` e execute esse SQL no painel administrativo. A tabela de autorização permite exatamente um titular e não pode ser alterada pela API pública.
4. Em Authentication → Sign In / Providers, desative **Allow new users to sign up** e o login anônimo; mantenha somente o provedor de e-mail necessário. Desative outros provedores. Use senha única e forte. Ative MFA também nas contas administrativas do Supabase e GitHub.
5. Configure o Site URL e a lista de Redirect URLs com o endereço exato `https://rafaelooliveira3124-oss.github.io/financia/`. Configure o envio de e-mails de recuperação e teste a entrega.
6. No repositório GitHub, em Settings → Secrets and variables → Actions → Variables, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave **publishable/anon pública**. Não use `service_role`, `sb_secret_` ou senha de banco. O build recusa chaves com formato secreto. Toda variável VITE é pública no JavaScript.
7. Publique novamente. Entre com sua conta e cadastre o autenticador TOTP no celular. O primeiro acesso exige confirmar um código. Nos próximos logins, use senha e autenticador. Nenhum dado financeiro é buscado pelo aplicativo antes da validação do acesso.

## Validação antes de inserir valores reais

- Verifique que o site sem configuração mostra apenas o bloqueio e que não oferece demonstração ou cadastro público.
- Em janela anônima, a URL deve pedir login. Sem credenciais, chamadas à tabela e ao RPC devem falhar.
- Com senha correta e sem código MFA, chamadas diretas não podem ler ou alterar dados.
- Com sua conta e MFA, salve um lançamento fictício, recarregue e confira o valor em outro dispositivo autenticado.
- Uma segunda conta de teste não autorizada (criada pelo administrador, se necessário) não deve ver dados nem criar uma linha própria, mesmo com MFA. Exclua a conta de teste pelo painel depois da verificação.
- Teste recuperação de senha, logout, ausência de dados após logout e conflitos entre abas. A recuperação de senha não desativa o MFA.
- Confirme no Supabase que `finance_states` está com RLS habilitada, a política restritiva está presente e `private.financia_owner` contém somente o seu UID.

Os testes locais em `src/security.test.ts` executam as migrações em PostgreSQL embarcado e cobrem visitante anônimo, usuário diferente, titular sem MFA, titular com MFA, alteração da autorização e e-mail não confirmado. Eles não substituem testes de integração do Auth, envio de e-mail e API no projeto Supabase real.

## Sessões, recuperação e limites

Tokens ficam em `sessionStorage`, isolados por aba e sem persistência permanente intencional. O estado financeiro fica na memória durante o uso e não é salvo em localStorage na versão autenticada. O aplicativo encerra a sessão local após 15 minutos sem interação; esse temporizador de navegador não substitui as políticas de expiração e revogação do Supabase. Uma exportação JSON contém dados sensíveis e deve ser guardada por você em local seguro.

Guarde acesso de recuperação ao painel administrativo e o backup do seu autenticador. Se perder o fator, recupere pelo painel administrativo do Supabase; não há uma opção pública que remova o MFA. Se suspeitar de comprometimento, revogue sessões no painel e troque as credenciais comprometidas. Tokens de acesso já emitidos podem permanecer válidos até sua expiração; reduzir o tempo de JWT no Supabase exige avaliar esse prazo e o funcionamento da renovação.

O GitHub Pages é uma hospedagem estática: qualquer pessoa pode abrir a tela de login e baixar o código. A privacidade dos valores depende de Auth + MFA + RLS no servidor. O build inclui CSP por meta tag para limitar recursos e conexões ao próprio site e ao projeto Supabase; GitHub Pages não permite configurar todos os cabeçalhos de segurança de uma aplicação com servidor. Se quiser restringir também quem pode sequer abrir a página, será necessário usar uma hospedagem com controle de acesso na borda ou VPN, em vez de GitHub Pages público.

Não há promessa de risco zero. Não registre dados reais antes de concluir a configuração e a verificação no projeto de produção. A versão publicada sem Supabase permanece bloqueada.

Referências oficiais: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [cadastros](https://supabase.com/docs/guides/auth/general-configuration).
