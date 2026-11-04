# Revisão de navegação e funcionamento no Safari

## Interface

- Menu lateral no desktop e uma faixa lateral compacta no celular, com nomes curtos, rótulos completos para acessibilidade e links nativos para cada tela.
- A faixa lateral tem rolagem própria em paisagem e reserva espaço para as áreas seguras do iPhone. O conteúdo fica ao lado, sem sobreposição.
- Em celulares estreitos, indicadores, filtros, investimentos e configurações passam para uma coluna. O histórico continua em cartões.
- Modais usam a altura do visualViewport para se ajustar ao teclado. Campos têm fonte de 16px no layout móvel.

## Funcionamento e falhas corrigidas

- Navegação usa links nativos, sem cancelar o toque do Safari. Atalhos programáticos mantêm a alternativa por hash caso pushState seja recusado.
- Preferências bloqueadas no navegador não derrubam a interface. Se sessionStorage não estiver disponível, os tokens ficam só na memória da aba, sem armazenamento persistente alternativo.
- A atualização de um token da mesma conta não desmonta formulários. A autorização e o MFA continuam sendo revalidados; perda de acesso remove a carteira da tela.
- Renovar o token não reinicia o prazo de inatividade.
- O carregamento não depende somente do evento INITIAL_SESSION. Rejeições de rede exibem erro e uma ação de nova tentativa.
- Categorias não perdem o nome digitado se o salvamento falhar. O retorno de versão do servidor é conferido antes de confirmar a operação na interface.
- Inicialização de categorias não depende de structuredClone. Há uma alternativa criptograficamente segura para criação de IDs quando randomUUID não estiver disponível.
- Uma falha inesperada de renderização mostra uma tela de recuperação em vez de deixar a página vazia.
- O fluxo de recuperação informa falha quando o serviço de e-mail recusa a solicitação.

## Verificação

`npm run build` e `npm test` passaram. São 6 testes de negócio/SQL e 23 testes de componentes e comportamento de navegador em DOM simulado. Cobrem gravações em PostgreSQL embarcado, RLS, MFA, compartilhamento, conflitos, formulários, toques, teclado, sessão e armazenamento bloqueado. Os testes não acessam os saldos reais.

A interface é compilada para Safari 16.4 ou mais recente, conforme o requisito mínimo do Tailwind CSS 4. Não foi possível executar inspeção visual em Safari/iPhone físico neste ambiente. O build, os testes automatizados e os recursos publicados são verificados; a confirmação no aparelho continua necessária.

## Reparo de banco ainda necessário em instalações afetadas

A revisão da interface não executa SQL administrativo. Se `Configurações → Verificar salvamento` indicar falha no validador, execute `supabase/fix-investment-validation.sql` no SQL Editor do projeto. O arquivo altera apenas a função de validação, sem mexer nos registros ou permissões. Não execute `setup.sql` em uma carteira existente. Consulte `CORRIGIR-SALVAMENTO.md`.

Documentação oficial: https://tailwindcss.com/docs/compatibility e https://supabase.com/docs/reference/javascript/auth-onauthstatechange.
