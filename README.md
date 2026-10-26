# LEVIA HUB — LEVIA BIOSCIENCE

Centro administrativo modular da LEVIA BIOSCIENCE, em ambiente de desenvolvimento.

**Estado atual:** HUB-04 com migrations e backend de autenticação, autorização e auditoria implantados no Supabase. A ativação do primeiro administrador real permanece bloqueada por revisão automática de autorização. Os módulos Social Studio, CRM e catálogo continuam demonstrativos e pertencem às etapas seguintes.

Cadastro público do Auth desativado e verificado por API em 26/10/2026: novas inscrições retornam `signup_disabled`. [Evidência](docs/evidence/hub04/auth-settings.json).

**Próxima etapa em desenvolvimento:** HUB-05 — catálogo, versões e campanhas fictícias em `/catalog-demo`, independente de login. As alterações da simulação duram somente até recarregar a página. A migration candidata é testada em banco descartável e não foi aplicada ao Supabase. [Escopo e testes](docs/delivery-reports/HUB-05-DEVELOPMENT.md).

## Execução e verificação

Bun **1.3.2**, React 19, TypeScript, TanStack Start/Router, Vite 8 e Tailwind 4. O lockfile versionado inclui as correções de segurança verificadas nesta entrega.

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run format:check
bun run build
bun run typecheck:generated
bun run test:generated
```

O servidor usa a URL e a chave **publicável** do projeto exclusivo de desenvolvimento. Podem ser substituídas por `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`; não definir chaves administrativas no frontend. A sessão cifrada é emitida e validada por `hub-session` no Supabase: nenhum segredo adicional precisa ser configurado no Lovable. Falha no Auth, na sessão ou na autorização nega o acesso.

## Rotas

| Caminho              | Acesso e finalidade                                               |
| -------------------- | ----------------------------------------------------------------- |
| `/`                  | Apresentação pública                                              |
| `/login`             | Login real por e-mail e senha                                     |
| `/activate`          | Definição de senha por link privado, de uso único                 |
| `/demo`              | Simulação pública, inteiramente sintética e sem privilégios reais |
| `/catalog-demo`      | Laboratório HUB-05: catálogo, tabelas e campanhas fictícias       |
| `/access-denied`     | Estado de acesso negado                                           |
| `/app`, `/app/core`  | Sessão válida e capacidade `core.read` no escopo `core`           |
| `/app/crm`           | Acesso administrativo mais `crm.read` no escopo `crm`             |
| `/app/social-studio` | Acesso administrativo mais `social.read` no escopo `social`       |

A autenticação não atribui permissões. Não existe cadastro público na interface. Tokens não são retornados por funções SSR ao JavaScript do navegador; o cookie de produção é cifrado, HttpOnly, Secure, SameSite=Lax e usa o prefixo `__Host-`.

## Banco e fronteiras de segurança

- Quatro tabelas em `hub_private`, nove capacidades, RLS habilitada e acesso direto negado a `anon`, `authenticated` e `service_role`.
- `hub-authorize` revalida a identidade no Auth e consulta conta habilitada, concessão, escopo, vigência e sessão viva.
- `hub-admin-write` usa a mesma identidade verificada e executa alterações e eventos em uma transação. Autoatribuição e delegação além da autorização original são negadas.
- `hub-session` usa AES-GCM por JWE e uma chave derivada dentro do runtime privado do Supabase. O host web recebe somente o envelope opaco e opera como backend para a interface.
- Todas as conexões PostgreSQL das funções exigem TLS e validação de certificado. O schema privado não é usado como API pública.
- A auditoria conserva a identificação original do ator mesmo quando o Auth remove sua referência. Atualizações e exclusões comuns dos eventos são proibidas.

O runtime Edge usa a credencial PostgreSQL gerenciada da plataforma, exclusivamente no backend. Sua custódia e rotação continuam sendo atribuição do proprietário do projeto. Os testes com papéis reais e a validação de sessão são independentes dessa credencial privilegiada.

## Migrations e recuperação

A migration original mantém o blob auditado `7e954d9ce51ce0e3e96021809241a1bb9a439c59`. A aplicação gerenciada gera versões remotas próprias. A correspondência entre versão, arquivo e SHA-256 está em [deployment-manifest.json](supabase/deployment-manifest.json).

**Não executar `db push` diretamente da pasta canônica**, pois seus timestamps históricos diferem dos timestamps atribuídos pela plataforma. Prepare uma cópia compatível com o ledger, sem editar SQL ou reparar histórico:

```bash
node scripts/stage-managed-migrations.mjs /tmp/levia-managed-staging
```

[Relatório de execução](docs/delivery-reports/HUB-04-WORK-EXECUTION.md), [operação e recuperação](docs/operations/HUB-04-OPERATIONS.md) e [evidências](docs/evidence/hub04/) descrevem o estado atual. Relatórios anteriores conservam o estado histórico e suas antigas restrições; não devem ser interpretados como a situação atual.

## Organização e limites

`src/app` compõe os módulos; `src/modules` contém domínio e integrações; `src/shared` não importa módulos. O roteador único continua sendo TanStack, com árvore gerada pelo build e ignorada no Git.

O Supabase é exclusivo do HUB. Não foram conectados o site institucional ou QR/rastreabilidade, nem importados acervos, dados clínicos ou financeiros. Não foram enviados comandos de desenvolvimento ao Lovable. Nenhum serviço pago foi contratado. A HUB-05 avança somente em desenvolvimento isolado; as HUB-06 a HUB-11 permanecem futuras.
