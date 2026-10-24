# HUB-03 — Interface Administrativa Navegável

**Data de referência:** 23/10/2026. **Status:** implementação em branch para auditoria, não aprovada autonomamente.

## Solicitado

Preservar a página institucional e adicionar interface administrativa navegável com sidebar responsiva, dashboard demonstrativo e áreas estáticas para Social Studio, CRM e Núcleo. Conservar TanStack Start/Router, identidade LEVIA e segurança por ausência de dados sensíveis. Entrega em PR Draft sem merge.

## Base verificada

- Repositório público `emagrecacomlevia-svg/crm-levia`; ID `1431576812`.
- HEAD original de `main`: `aaf2f8c0df136d1f2b593ae53dfd585e2276548b`.
- PR #1 HUB-02 já integrado; não havia novo trabalho concorrente.
- Nova branch `feature/hub-03-admin-shell`, criada diretamente da main verificada.
- `AGENTS.md` e configurações de Lovable preservados. Nenhum force-push, rebase, integração externa ou deploy.

## Executado

- Rota institucional `/` preservada, com link TanStack **Abrir demonstração do HUB**.
- Rota `/app` com visão geral ilustrativa, sem métricas empresariais fictícias.
- Rotas `/app/social-studio`, `/app/crm` e `/app/core` com recursos apenas previstos e sem ações de negócio.
- Único layout `AdminShell`, sidebar desktop, cabeçalho, breadcrumb textual de seção, aviso permanente e footer.
- Menu móvel via Radix Dialog: abre/fecha, links com fechamento ao selecionar, foco gerenciado por Radix, link de pular conteúdo, estados ativos com `aria-current` e texto.
- UI compartilhada tipada em `src/shared`; configuração em `src/app`; páginas específicas isoladas em `src/modules`. Sem dependências novas.
- Suíte ampliada com testes de rotas, páginas, navegação e interações de menu.
- Workflow GitHub Actions reordena build antes do typecheck/testes, pois a geração automática de `routeTree.gen.ts` ocorre por TanStack/Vite.

## Segurança e limites

Todas as páginas são **públicas, demonstrativas e sem autenticação**. Não existe banco, CRUD, integração com Google Drive, redes sociais, Supabase, Auth, RLS, publicação, aprovação real ou login. Não são utilizados dados reais, credenciais ou documentos institucionais confidenciais. A existência visual de cartões ou avisos não demonstra uma funcionalidade empresarial.

## Testes e limitações

Os resultados verificáveis do GitHub Actions e commits deverão ser relatados no PR. A ausência de navegador real para captura em ~320/390 e 1440 px, se confirmada, permanecerá **pendência de aceite visual**, não deve ser relatada como teste concluído.

O consultor audita, o responsável aprova, o desenvolvedor apenas executa. Não realizar merge nem iniciar HUB-04.

## Evidências verificadas no GitHub Actions

A primeira execução integral aprovada para HUB-03 foi [GitHub Actions #40056763347](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40056763347), relativa ao SHA `b95f3b181ce80e7d7e823f4d012b5493bf89fc30`. O job completou com **sucesso**: `bun install --frozen-lockfile` (Bun 1.3.2), lint, validação de formatação específica, `prettier --check .`, build Vite/Nitro, typecheck TypeScript e testes Vitest.

**Testes:** 4 arquivos, **22 testes aprovados**, incluindo os testes herdados da HUB-02, acesso à rota `/`, matching direto das quatro rotas administrativas, composição sob o layout `/app`, renderização das páginas, estados ativos acessíveis e comportamento de abertura/fechamento do menu móvel em jsdom. Não foram usados snapshots como substitutos de comportamento.

**Avisos persistentes:** ESLint 0 erros e 6 avisos herdados `react-refresh/only-export-components` nos componentes `src/components/ui/{badge,button,form,navigation-menu,sidebar,toggle}.tsx`. Vite/Nitro informa aviso não bloqueante de `inlineDynamicImports` com `codeSplitting`; GitHub Actions informa depreciação de Node 20 em `actions/checkout@v4`. Esses avisos não foram introduzidos pelo shell HUB-03.

**Iterações corrigidas:** runs preliminares falharam apenas por formatação de JSX/TSX e tabelas Markdown. Foram corrigidos os arquivos apontados pelo Prettier, sem retirar arquivos do escopo da checagem. O pipeline da versão `b95f3b1` foi aprovado integralmente; alterações posteriores limitadas a este texto e à ordem dos comandos documentados deverão passar novamente pelo CI.

**Verificação modular:** nenhuma importação `@/modules/...` foi introduzida em `src/shared/`; módulos `core`, `crm` e `social-studio` permanecem isolados, enquanto a composição e o menu ficam em `src/app`.

**Validação visual:** pendente, **não verificada em navegador real** nas larguras 320, 390, 768, 1280 e 1440 px. Há regras Tailwind responsivas e testes de interação em jsdom, mas isso não equivale a capturas visuais. O ambiente local disponível possui Chromium, porém não tem dependências Bun do repositório nem acesso de rede para instalá-las; nenhuma infraestrutura, serviço pago ou deploy foi criado para gerar screenshots.

**Não executado:** merge do PR Draft #2, publicação, alterações de infraestrutura/Cloudflare, Supabase, Auth/RLS, conexão Drive, ações Lovable AI ou uso de informações reais.

**Pendente para auditoria:** avaliação visual complementar em navegador, decisão sobre os avisos herdados, revisão final do Consultor e aprovação do responsável. A HUB-04 não foi iniciada.
 
## HUB-03-C01 — Correções técnicas do parecer AT-007

**Base auditada:** `main` em `aaf2f8c0df136d1f2b593ae53dfd585e2276548b`; branch `feature/hub-03-admin-shell` em `aa174d939baf99373b228002d15c1deb905a3128`. PR Draft #2 preservado.

**Defeito A:** a árvore `src/routeTree.gen.ts` estava rastreada desde HUB-02 e refletia somente a página `/`. A geração automática no Vite build mascarava a inconsistência no CI. **Correção:** retirar exclusivamente a árvore gerada do índice, ignorá-la e declarar `bun run routes:prepare` para geração pelo plugin TanStack/Vite já instalado. `bun run typecheck`, `bun run test` e `bun run test:watch` executam a geração antes das verificações, mesmo após checkout limpo; o CI confirma ausência inicial, presença das cinco rotas após build e usa verificações `:generated` para não duplicar compilação.

**Defeito B:** o mock de `Link` em `src/tests/admin-shell.test.tsx` renderizava `<a href>` sem impedir a navegação nativa do jsdom. O teste de seleção no menu móvel executava `fireEvent.click` e disparava `Error: Not implemented: navigation (except hash changes)`. **Correção:** o mock agora executa `event.preventDefault()`, registra o destino simulado, repassa o `onClick` recebido e verifica que a seleção fecha o diálogo. Não há supressão de `console.error`.

**Validação visual C:** previsto workflow de navegador em runner efêmero com servidor em `127.0.0.1`, Chromium/Playwright de versão fixada e artefatos de screenshots públicos do projeto demonstrativo. Resultados efetivos somente após sua execução. Nenhum serviço externo ou deploy.
