# Financia

Gestão financeira pessoal e compartilhada com React, TypeScript, Tailwind CSS, Radix/shadcn, Recharts e Supabase. A carteira é privada: exige um login autorizado e autenticação em duas etapas. O código e a página de entrada podem ser públicos no GitHub Pages.

## Executar e testar

Use Node.js 22.16 ou superior. Execute `npm ci`, `npm run dev`, `npm test` e `npm run build`. A saída de produção fica em `dist/`. Sem as variáveis do Supabase, a produção mostra uma tela de configuração bloqueada. Demonstração só pode ser habilitada no desenvolvimento com `VITE_ENABLE_DEMO=true`.

## Banco e acesso

Para um projeto Supabase novo, siga `SECURITY.md` e execute `supabase/setup.sql` uma vez. Autorize o titular no SQL administrativo e desative cadastros públicos. Nunca execute a instalação inicial em um banco que já contém sua carteira.

Para dois logins usando a mesma carteira, siga `COMPARTILHAR.md`. Cada pessoa mantém senha e autenticador próprios; ambas podem consultar e alterar os mesmos registros. Usuários não autorizados não têm acesso. Autorizações são mantidas pelo administrador no banco, não pelo frontend.

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com URL e chave pública publishable/anon. Nunca use service_role, sb_secret_ ou senha de banco no frontend. No GitHub, as variáveis ficam em Settings → Secrets and variables → Actions → Variables. Cada push na main executa os testes, gera o site e publica pelo Pages. Veja `PUBLICAR-GITHUB.md`.

## Regras financeiras

Valores são inteiros em centavos. Saldo = saldo inicial + entradas − despesas − aportes + resgates + ajustes. Investimentos = posição inicial + aportes − resgates + avaliações. Transferências não entram como receitas ou despesas. Rendimentos não realizados não alteram a conta.

Cadastrar um investimento representa uma posição já existente. Para usar dinheiro da conta, cadastre uma posição zero e registre um aporte. Atualizar o valor pede o novo saldo atual e calcula a diferença de avaliação. O dashboard tem seis indicadores e um único gráfico de rosca. As movimentações podem ser pesquisadas, filtradas, ordenadas, editadas e excluídas com confirmação.

O estado da carteira fica em uma linha JSONB protegida por RLS, autorização e MFA. Gravações usam versão esperada para impedir sobrescrita silenciosa entre acessos. Use Atualizar carteira para carregar alterações feitas por outra sessão. Não há sincronização em tempo real. Exportação JSON disponível em Configurações; guarde o arquivo em local privado.

## Safari e celular

O menu fica na lateral em todos os tamanhos: completo no desktop e compacto no celular. O conteúdo, os cartões e os formulários se ajustam ao espaço restante. A lateral pode ser rolada em paisagem; modais se ajustam ao teclado. Links nativos permitem toque e teclado sem interceptar a navegação do navegador.

O alvo é Safari 16.4 ou superior, conforme o requisito do Tailwind CSS 4. Os testes de componentes usam DOM simulado; a inspeção visual em aparelho físico não foi executada neste ambiente. Não há aplicativo nativo ou funcionamento offline.

Tokens usam sessionStorage por aba e memória se o navegador bloquear esse armazenamento. Preferências de aparência não interrompem a interface se o armazenamento estiver indisponível. Renovar a sessão preserva formulários da mesma conta; perda de autorização bloqueia a tela. A sessão local é encerrada após 15 minutos sem interação.

## Diagnóstico e manutenção

Configurações → Verificar salvamento faz uma verificação sem alterar a carteira. Se o validador de investimentos ainda estiver com o erro original, execute somente `supabase/fix-investment-validation.sql` no SQL Editor administrativo. Não recrie tabelas. Veja `CORRIGIR-SALVAMENTO.md` e o resumo das alterações em `REVISAO.md`.

Os testes cobrem negócios, moeda, banco, compartilhamento, segurança, formulários, navegação, MFA, sessão e armazenamento bloqueado. Eles não consultam saldos reais. Login, e-mails e acesso dos dois usuários devem ser confirmados no projeto de produção.