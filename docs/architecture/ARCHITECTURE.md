# LEVIA HUB — Arquitetura inicial

**Estado atual:** HUB-04, 25/10/2026. Autenticação SSR e backend Supabase implantados; primeiro administrador real pendente de autorização específica. A estrutura abaixo registra a evolução inicial. Consulte [operação atual](../operations/HUB-04-OPERATIONS.md).

## Princípios

Monólito modular evolutivo. Um frontend React/TypeScript com separação por capacidades e código compartilhado mínimo. A HUB-04 acrescenta o módulo `identity`, adaptadores SSR e três Edge Functions. O Supabase exclusivo de desenvolvimento contém quatro tabelas privadas com RLS; não há dados empresariais nos módulos demonstrativos.

## Estrutura atual

```text
src/
  app/
    config/hub-modules.ts
    hub-home.tsx
    config/admin-navigation.ts
    layouts/admin-navigation.tsx
    layouts/admin-shell.tsx
    pages/admin-overview.tsx
    layouts/hub-shell.tsx
    providers/README.md
  modules/
    social-studio/index.ts
    social-studio/pages/index.tsx
    crm/index.ts
    crm/pages/index.tsx
    core/index.ts
    core/pages/index.tsx
  shared/
    types/hub-module.ts
    lib/README.md
    ui/module-card.tsx
    ui/page-header.tsx
    ui/status-indicator.tsx
    ui/section-card.tsx
    ui/feature-grid.tsx
    ui/environment-notice.tsx
  routes/
    __root.tsx
    index.tsx
    app.tsx
    app.index.tsx
    app.social-studio.tsx
    app.crm.tsx
    app.core.tsx
  tests/hub-home.test.tsx
  tests/admin-shell.test.tsx
  tests/admin-pages.test.tsx
  test/app-routing.test.tsx
```

TanStack Start define o shell de roteamento e SSR em `src/routes/__root.tsx`, `src/router.tsx`, `src/start.ts`, `src/server.ts`. `src/routeTree.gen.ts` é gerado e não deve ser editado manualmente. O layout visual `HubShell` não constitui um segundo roteador. A família de rotas `/app` utiliza um único `AdminShell` em `src/routes/app.tsx` com `<Outlet />`; não há novo roteador. O registry de rotas `routeTree.gen.ts` é gerado pelo build antes de typecheck/test em CI. O provider de TanStack Query continua no root; a pasta `app/providers` é apenas reserva de organização.

## Limites de módulos

- **social-studio:** metadados de apresentação da capacidade editorial futura; sem armazenamento, aprovação real, publicação ou acesso ao Drive.
- **crm:** apenas área reservada; sem entidades comerciais, funil, preços ou lógica de vendas.
- **core:** página demonstrativa de catálogo referencial, versões e auditoria; os dados empresariais ainda não são persistidos.
- **identity:** autenticação SSR, sessão cifrada, autorização por capacidade e integração com o backend privado de auditoria.
- **app/config:** compõe os módulos com imports de `@/modules/*` exclusivamente na camada de aplicação.
- **shared:** tipos, utilitários e componentes reutilizáveis; não importa módulos de domínio e não acessa serviços.

Regra de dependência: `app → modules → shared` e `app → shared`; a direção `shared → modules` é proibida. A lista de cartões institucionais é composta em `src/app/config/hub-modules.ts`.

A HUB-03 introduz navegação composta em `src/app/config/admin-navigation.ts`. As páginas dos três módulos permanecem isoladas em `src/modules/*/pages`. `src/shared/` contém somente componentes genéricos. Na HUB-04, as rotas `/app` são protegidas por identidade, sessão viva e capacidades verificadas no banco. As páginas dos módulos ainda não salvam dados empresariais.

Em etapas futuras, as regras de domínio devem residir nos módulos e as integrações passar por contratos explícitos. Não presumir que uma arte, preço, estudo ou conteúdo histórico esteja aprovado.

## Tecnologias e evolução

A stack inicial é React 19 + TypeScript 5.8 + TanStack Start/Router + Vite 8 + Tailwind CSS 4 + Bun + Vitest/React Testing Library. A configuração Lovable existente foi preservada. O pacote `@lovable.dev/vite-tanstack-config` configura plugins essenciais; não duplicá-los. A aplicação se comunica com Auth e com as funções de autorização pelo servidor. As sessões usam envelopes AES-GCM emitidos no Supabase, sem segredo no host web. O schema `hub_private` não concede acesso direto a clientes. A primeira identidade real ainda não foi criada.

O workflow de qualidade não faz deploy. O monólito modular pode evoluir sem alteração de roteador ou migração de tecnologia não autorizada.
