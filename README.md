# Financia

Aplicação React + TypeScript, Tailwind CSS, componente Button no padrão shadcn/ui com CVA, Dialog acessível Radix, Lucide e Recharts. A versão de produção exige autenticação, autorização exclusiva do titular e MFA. Sem configuração, o painel permanece bloqueado. Consulte SECURITY.md para ativar.

## Executar

Node.js 22 ou superior. `npm install`, `npm run dev`. Validação: `npm test` e `npm run build`. A saída está em `dist/`.

## Ativar Supabase

1. Siga o procedimento completo em `SECURITY.md`: execute as duas migrações, autorize o titular e desative novos cadastros.
2. Copie `.env.example` para `.env` e preencha URL e chave pública (`anon` ou publishable). Nunca use service_role ou chave secreta.
3. Em Authentication → URL Configuration, cadastre a URL final do aplicativo como Site URL e Redirect URL. Configure o envio de e-mail conforme seu ambiente.
4. Execute o build novamente e publique `dist`. Com essas variáveis a demonstração é desativada: o aplicativo exige autenticação, inicia contas vazias e persiste no PostgreSQL.
5. Antes do uso real, valide em seu projeto cadastro, confirmação de e-mail, login, recuperação, logout e isolamento com duas contas. Confirme que uma conta não consegue consultar nem alterar o user_id da outra via API. Esta entrega não dispõe de um projeto Supabase provisionado para testar esses fluxos remotamente.

Referências oficiais: [Auth](https://supabase.com/docs/guides/auth), [recuperação de senha](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [build Vite](https://vite.dev/guide/build).

## Regras e dados

Valores são inteiros em centavos. O saldo é derivado do saldo inicial + entradas − despesas − aportes + resgates + ajustes. O investimento é a posição inicial + aportes − resgates + diferenças de avaliação. Transferências não afetam os indicadores de receita/despesa. Rendimentos não realizados não alteram a conta. Capital líquido aplicado acompanha aportes e resgates; um resgate com lucro pode levar esse capital a valor negativo, preservando o ganho acumulado. Cadastro de investimento é uma posição preexistente, sem débito na conta: novos investimentos devem começar com zero e receber um aporte.

Movimentos aceitam datas até hoje. Saldos são atuais e independem dos filtros. Últimos três meses inclui o mês atual. Ajustes e rendimentos são diferenças assinadas. Histórico permite editar e excluir todos os lançamentos. Exclusões que deixam investimento negativo são bloqueadas. Há uma única conta corrente nesta versão.

O estado de cada usuário ocupa uma linha JSONB validada pelo banco e isolada por RLS. Cada salvamento usa uma função SQL transacional com versão esperada: gravações de uma aba desatualizada são recusadas, evitando sobrescrita silenciosa. Recarregue a página quando houver conflito. Exportação JSON disponível nas configurações.

## Uso no celular

A mesma URL funciona no navegador do celular. A interface tem abas de navegação no topo com área segura para iPhone, visíveis durante a rolagem, histórico em cartões com ações de toque, filtros reorganizados e formulários em painel inferior. Campos usam fonte de 16px para evitar zoom automático durante a digitação no iOS. Em telas estreitas os campos ficam em uma coluna. Não há aplicativo nativo ou funcionamento offline nesta versão.

A demonstração só pode ser habilitada em desenvolvimento com VITE_ENABLE_DEMO=true. Nela, os registros são locais e separados por navegador. Com Supabase configurado, os dados da conta ficam disponíveis nos dois dispositivos; recarregue para carregar alterações feitas no outro dispositivo. A versão mobile foi verificada por compilação; a inspeção visual e o teste em aparelho físico ainda precisam ser feitos.

## Testes

Testes automatizados cobrem precisão monetária, filtros, edição, exclusão, aportes, resgates e rendimentos. O modo demo persiste apenas neste navegador. Login, envio de e-mail e RLS exigem projeto Supabase configurado e teste de integração antes do uso com dados reais.
