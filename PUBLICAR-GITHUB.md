# Publicar no GitHub Pages

O repositório deve conter os arquivos deste projeto na raiz: `package.json`, `src`, `index.html`, etc. Não envie `node_modules`, `.env`, dados exportados, `.git` ou `.openai`.

1. Crie o repositório `financia` na sua conta. No plano gratuito, use um repositório público para o GitHub Pages.
2. Após enviar o código à branch `main`, abra **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Em **Actions**, abra **Publicar Financia no GitHub Pages**. Se a primeira execução falhar porque Pages ainda não estava habilitado, clique em **Re-run all jobs**.
4. Aguarde os jobs `build` e `deploy` terminarem. O endereço aparecerá em **Settings → Pages** e no ambiente `github-pages`.

Para o usuário `rafaelooliveira3124-oss` e repositório `financia`, o endereço esperado é `https://rafaelooliveira3124-oss.github.io/financia/`. Ele só estará disponível após o deploy terminar.

## Dados em vários dispositivos

Sem Supabase, o site de produção fica bloqueado. Para sincronizar seus dados reais, execute as duas migrações e autorize o titular conforme SECURITY.md e configure **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`: URL do seu projeto.
- `VITE_SUPABASE_ANON_KEY`: chave pública anon/publishable. Nunca use service_role ou chave secreta; toda variável VITE será incluída no JavaScript público.

Cadastre o endereço completo do GitHub Pages, incluindo `/financia/`, na configuração de autenticação do Supabase (Site URL e Redirect URLs). Rode o workflow novamente após alterar as variáveis.

## Atualizações

Cada push para `main` executa testes, gera o site e publica automaticamente. O site usa caminhos relativos para carregar os arquivos tanto no GitHub Pages quanto em um domínio próprio.

Documentação: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
