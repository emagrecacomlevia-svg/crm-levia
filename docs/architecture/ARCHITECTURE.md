# LEVIA HUB — Arquitetura inicial

**Referência:** HUB-02 e HUB-03, 23/10/2026. **Estado:** navegação administrativa demonstrativa, não produção.

## Princípios

Monólito modular evolutivo. Um frontend React/TypeScript com separação por capacidades e código compartilhado mínimo. A camada de persistência e controle de acesso não existe nesta fase. **Supabase é somente um candidato aprovado conceitualmente para ambiente administrativo independente em etapas futuras**; nenhum projeto, esquema ou cliente foi criado.

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
- **core:** representação arquitetural futura de identidade, catálogo referencial, versões e auditoria; sem autenticação ou proteção de dados.
- **app/config:** compõe os módulos com imports de `@/modules/*` exclusivamente na camada de aplicação.
- **shared:** tipos, utilitários e componentes reutilizáveis; não importa módulos de domínio e não acessa serviços.

Regra de dependência: `app → modules → shared` e `app → shared`; a direção `shared → modules` é proibida. A lista de cartões institucionais é composta em `src/app/config/hub-modules.ts`.

A HUB-03 introduz navegação composta em `src/app/config/admin-navigation.ts`. As páginas dos três módulos permanecem isoladas em `src/modules/*/pages`. `src/shared/` contém somente componentes genéricos. Todas as telas administrativas são públicas, não salvam dados e não autenticam visitantes.

Em etapas futuras, as regras de domínio devem residir nos módulos e as integrações passar por contratos explícitos. Não presumir que uma arte, preço, estudo ou conteúdo histórico esteja aprovado.

## Tecnologias e evolução

A stack inicial é React 19 + TypeScript 5.8 + TanStack Start/Router + Vite 8 + Tailwind CSS 4 + Bun + Vitest/React Testing Library. A configuração Lovable existente foi preservada. O pacote `@lovable.dev/vite-tanstack-config` configura plugins essenciais; não duplicá-los. Banco, RLS, auth, CI de deploy e serviços externos exigem aprovação posterior.

O workflow de qualidade não faz deploy. O monólito modular pode evoluir sem alteração de roteador ou migração de tecnologia não autorizada.
