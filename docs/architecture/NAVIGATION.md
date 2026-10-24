# LEVIA HUB — Navegação demonstrativa HUB-03

## Contrato de rotas

| Rota                 | Componente                                  |
| -------------------- | ------------------------------------------- |
| `/`                  | `HubHome`                                   |
| `/app`               | `AdminOverviewPage`, dentro de `AdminShell` |
| `/app/social-studio` | `SocialStudioPage`, dentro de `AdminShell`  |
| `/app/crm`           | `CrmPage`, dentro de `AdminShell`           |
| `/app/core`          | `CorePage`, dentro de `AdminShell`          |

O roteamento é feito exclusivamente com TanStack Router, por `src/routes/app.tsx`, `app.index.tsx` e as rotas filhas. O plugin TanStack/Vite existente já gera `src/routeTree.gen.ts` a partir de `src/routes`; não adicionar CLI, gerador paralelo ou editar esse arquivo manualmente.

## Política HUB-03-C01: árvore gerada não versionada

A árvore `src/routeTree.gen.ts` anteriormente versionada registrava somente `/`, embora o build em CI regenerasse cinco rotas. Isso impedia que o checkout puro contivesse um registry coerente até o build. **A fonte de verdade são os arquivos `src/routes/*.tsx`; o manifesto gerado é ignorado pelo Git** com `src/routeTree.gen.ts` no `.gitignore`. O arquivo foi retirado do índice Git sem substituir o gerador do Lovable/TanStack. Continua excluído do Prettier.

A geração declarada usa apenas o Vite já instalado:

```bash
bun install --frozen-lockfile
bun run routes:prepare           # vite build, gera routeTree.gen.ts pelo plugin oficial
bun run typecheck:generated      # usa a árvore recém-gerada
bun run test:generated           # usa a árvore recém-gerada
```

Também funciona a partir de checkout limpo, sem qualquer etapa manual prévia:

```bash
bun run typecheck                # chama routes:prepare antes do tsc
bun run test                     # chama routes:prepare antes do Vitest
bun run test:watch               # chama routes:prepare antes do watcher
```

O CI executa `test ! -e src/routeTree.gen.ts` no checkout, depois `bun run build` e verifica que o arquivo gerado menciona `/`, `/app`, `/app/social-studio`, `/app/crm` e `/app/core`; por fim executa comandos `:generated` após o build para evitar compilações redundantes no runner. Essa escolha não altera `vite.config.ts`, o plugin Lovable, `src/router.tsx` nem o histórico existente.

Referência externa: [TanStack Router — Vite e geração de rotas](https://tanstack.com/router/latest/docs/installation/with-vite).

## Componentes

- `AdminShell`: sidebar desktop, cabeçalho fixo, conteúdo via `<Outlet />`, aviso permanente, versão e rodapé.
- `AdminNavigation`: única origem de links, texto, ícones, estado ativo `aria-current="page"` e indicação textual **ATUAL**.
- `admin-navigation.ts`: configuração das quatro rotas, composta na camada `app`.
- `PageHeader`, `StatusIndicator`, `SectionCard`, `FeatureGrid`: componentes puros em `shared`.
- As páginas de Social Studio, CRM e Core permanecem nos respectivos módulos e importam somente `shared`.

## Mobile e acessibilidade

A sidebar persistente surge em `lg` (>=1024px). Abaixo desse breakpoint, um botão **Abrir menu** aciona um `@radix-ui/react-dialog` modal: gerencia foco, teclado e `Escape`; o botão **Fechar menu** é rotulado, e clicar em destino fecha o diálogo. A navegação contém nomes acessíveis, link de pular conteúdo, `aria-current`, reforço textual do estado ativo e estilos de foco. O conteúdo permanece sem sobreposição quando o diálogo não está aberto.

Larguras alvo para auditoria visual: 320, 390, 768, 1280 e 1440 px. Testes jsdom cobrem renderização, estados e comportamento do menu; não demonstram responsividade visual real. **Nenhuma screenshot é equivalente a uma homologação sem navegador real.**

## QA em Chromium e evidências visuais (HUB-03-C01)

O workflow gratuito `.github/workflows/browser-qa.yml` usa Bun 1.3.2 e Node 22 no runner `ubuntu-24.04`. A versão `playwright@1.56.1` é instalada **somente** em `$RUNNER_TEMP/levia-qa`, sem alterar dependências do projeto ou o `bun.lock`. O navegador Chromium é instalado no runner efêmero. Não há serviço pago, persistência do runner ou publicação.

O servidor inicia exclusivamente em `http://127.0.0.1:4173` e `scripts/qa-browser.cjs` verifica as cinco rotas em larguras 320, 390, 768, 1280 e 1440 px, incluindo acesso direto, título, rota ativa, aviso de demonstração e ausência de overflow horizontal. Em mobile o teste abre a navegação para inspecionar a rota ativa; também testa entrada SPA, seleção de módulo, `Escape`, abertura/fechamento e gerenciamento de foco. Falhas de console ou runtime são registradas no JSON e tornam a execução vermelha.

As capturas `dashboard-desktop-1440.png`, `dashboard-mobile-390.png`, `social-studio-desktop-1440.png` e `menu-mobile-aberto-390.png` são armazenadas, junto a `qa-result.json`, no artefato GitHub `hub-03-browser-qa` por **14 dias**. Os artefatos contêm exclusivamente conteúdo sintético visível da aplicação. Esta configuração evita nova biblioteca de teste no projeto e restringe os custos às execuções de PR/acionamento manual; não executar rotinas periódicas.

Para reproduzir em runner ou máquina preparada com Chromium/Playwright 1.56.1:

```bash
bun install --frozen-lockfile
bun run dev --host 127.0.0.1 --port 4173
# Em outro terminal:
QA_BASE_URL=http://127.0.0.1:4173 QA_PLAYWRIGHT=/caminho/para/node_modules/playwright node scripts/qa-browser.cjs
```

A conferência de layout considera screenshots reais, além de testes automatizados; não equivale a auditoria científica, de segurança ou de conteúdo. O uso de full-page screenshot no menu captura também o conteúdo abaixo da área do diálogo, que é restrito à viewport por design.

## Segurança

O menu **não** fornece autenticação. Todas as rotas são públicas, não aceitam registros reais e não persistem dados. O uso do componente Radix Dialog para navegação não simula permissões ou segurança.
