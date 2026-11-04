# Correção de gravação de investimentos e movimentações

O validador SQL original reutilizava `e` como variável PL/pgSQL e alias de uma consulta. Quando a carteira incluía um investimento, o PostgreSQL gerava `column reference "e" is ambiguous`. O tratamento de erro retornava `false`, e o salvamento era recusado como dados inválidos. O frontend também não mostrava corretamente os erros estruturados retornados pelo Supabase.

## Carteira já em uso

Execute **somente** `supabase/fix-investment-validation.sql` no SQL Editor administrativo do seu projeto. O arquivo substitui apenas o validador. Não execute `setup.sql`, não recrie tabelas e não execute novamente a autorização de usuários.

A correção mantém saldos, lançamentos, investimentos, versões, permissões e exigência de MFA. É possível executar esse arquivo de reparo novamente sem alterar registros. A cópia em `supabase/migrations/20261104025016_fix_investment_validation.sql` mantém o histórico da alteração. Instalações novas já recebem o validador corrigido em `setup.sql`.

Após executar, recarregue o site. Os formulários passam a preservar os campos e mostrar a mensagem no próprio modal se houver erro. Atualização de investimento pede o **novo valor atual**, e o aplicativo calcula a diferença automaticamente. Moeda aceita vírgula brasileira e ponto decimal de teclados móveis. O site valida datas reais e monta a data padrão sem depender da ordem de formatação do navegador.

## Verificação

Os testes em `src/persistence.test.ts` reproduzem o erro com o SQL original, aplicam a correção e executam gravações reais em PostgreSQL embarcado, com RLS e MFA: cadastro de investimento, aporte, despesa, rendimento, resgate, edição, exclusão e leitura posterior. Também verificam que um investimento negativo é recusado sem modificar o estado salvo.

Os testes em `src/App.ui.test.tsx` montam os componentes React em DOM de teste e exercitam os mesmos formulários nas larguras configuradas de desktop e celular. Eles cobrem navegação, cadastro, edição, exclusão, atualização de posição, erro estruturado do servidor, nova tentativa, resgate inválido e bloqueio de envio duplicado. Esses testes não substituem inspeção visual em navegador ou aparelho físico.
