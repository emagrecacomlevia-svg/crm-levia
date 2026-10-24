# LEVIA HUB — Navegação demonstrativa HUB-03

## Contrato de rotas

| Rota                 | Componente                                  |
| -------------------- | ------------------------------------------- |
| `/`                  | `HubHome`                                   |
| `/app`               | `AdminOverviewPage`, dentro de `AdminShell` |
| `/app/social-studio` | `SocialStudioPage`, dentro de `AdminShell`  |
| `/app/crm`           | `CrmPage`, dentro de `AdminShell`           |
| `/app/core`          | `CorePage`, dentro de `AdminShell`          |

O roteamento é feito exclusivamente com TanStack Router, por `src/routes/app.tsx`, `app.index.tsx` e as rotas filhas. `src/routeTree.gen.ts` é gerado pelo plugin existente; não editá-lo manualmente. O CI executa `bun run build` antes de TypeScript/Vitest para regeneração do manifesto.

## Componentes

- `AdminShell`: sidebar desktop, cabeçalho fixo, conteúdo via `<Outlet />`, aviso permanente, versão e rodapé.
- `AdminNavigation`: única origem de links, texto, ícones, estado ativo `aria-current="page"` e indicação textual **ATUAL**.
- `admin-navigation.ts`: configuração das quatro rotas, composta na camada `app`.
- `PageHeader`, `StatusIndicator`, `SectionCard`, `FeatureGrid`: componentes puros em `shared`.
- As páginas de Social Studio, CRM e Core permanecem nos respectivos módulos e importam somente `shared`.

## Mobile e acessibilidade

A sidebar persistente surge em `lg` (>=1024px). Abaixo desse breakpoint, um botão **Abrir menu** aciona um `@radix-ui/react-dialog` modal: gerencia foco, teclado e `Escape`; o botão **Fechar menu** é rotulado, e clicar em destino fecha o diálogo. A navegação contém nomes acessíveis, link de pular conteúdo, `aria-current`, reforço textual do estado ativo e estilos de foco. O conteúdo permanece sem sobreposição quando o diálogo não está aberto.

Larguras alvo para auditoria visual: 320, 390, 768, 1280 e 1440 px. Testes jsdom cobrem renderização, estados e comportamento do menu; não demonstram responsividade visual real. **Nenhuma screenshot é equivalente a uma homologação sem navegador real.**

## Segurança

O menu **não** fornece autenticação. Todas as rotas são públicas, não aceitam registros reais e não persistem dados. O uso do componente Radix Dialog para navegação não simula permissões ou segurança.
