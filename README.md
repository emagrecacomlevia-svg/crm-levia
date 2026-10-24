# LEVIA HUB — LEVIA BIOSCIENCE

Centro administrativo digital da LEVIA BIOSCIENCE.

**Estado:** HUB-03 — interface administrativa navegável demonstrativa. Não é aplicação de produção. Todos os dados apresentados são sintéticos ou textos estáticos. Nenhum módulo de negócio foi implementado e não existe autenticação nem persistência.

## Módulos previstos

- **Social Studio:** primeiro módulo funcional próprio, condicionado a futuras etapas de desenvolvimento.
- **CRM de Vendas:** espaço reservado; construção de CRM próprio depende de decisão empresarial.
- **Núcleo Administrativo:** base compartilhada futura de identidade, papéis, referências, versões e auditoria.

Os cartões da página inicial **não** indicam recursos disponíveis, autenticação ou segurança operacional.

## Tecnologias existentes preservadas

React 19, TypeScript 5.8, TanStack Start/Router, Vite 8, Tailwind CSS 4, componentes Radix/shadcn, Bun (lockfile `bun.lock`), Vitest e React Testing Library.

A configuração de build de TanStack Start provida por `@lovable.dev/vite-tanstack-config` foi mantida, assim como o roteamento em `src/routes` e os recursos do Lovable já conectados ao projeto.

## Requisitos de desenvolvimento

- Bun **1.3.2** (mesma versão utilizada no CI).
- Git para clonar o repositório.
- Nenhuma credencial, variável secreta ou conexão Supabase é necessária para executar **esta interface demonstrativa**. O projeto de desenvolvimento `levia-hub-dev` foi provisionado separadamente na HUB-04A, **não integrado ao frontend**.

```bash
git clone https://github.com/emagrecacomlevia-svg/crm-levia.git
cd crm-levia
git checkout feature/hub-03-admin-shell
bun install --frozen-lockfile
bun run dev
```

Acesse o endereço local indicado pelo Vite. Para verificar:

```bash
bun run lint
bun run format:check
bun run build
bun run typecheck
bun run test
```

O CI executa estes comandos sem publicação. `bun run format` **modifica** arquivos; use somente para ajustes locais intencionais.

## Rotas navegáveis da demonstração

| Caminho              | Conteúdo                                                         |
| -------------------- | ---------------------------------------------------------------- |
| `/`                  | Página institucional preservada, com entrada para a demonstração |
| `/app`               | Visão geral administrativa                                       |
| `/app/social-studio` | Planejamento editorial demonstrativo                             |
| `/app/crm`           | Área reservada CRM                                               |
| `/app/core`          | Referência do núcleo administrativo                              |

Todas as rotas estão **públicas e sem autenticação**. Navegação é real via TanStack Router; não há ações de salvar, aprovar, publicar ou operar dados. O menu móvel é implementado com Radix Dialog e fechamento acessível. A verificação de navegação contempla testes de UI e de matching do TanStack.

A árvore `src/routeTree.gen.ts` é **gerada pela integração TanStack/Vite e ignorada pelo Git**. A partir de checkout limpo, `bun run typecheck`, `bun run test` e `bun run test:watch` executam `routes:prepare` (build Vite) antes da verificação. No CI, o build único precede `typecheck:generated` e `test:generated`, evitando duplicar compilação. Consulte [Navegação](docs/architecture/NAVIGATION.md) e [Relatório HUB-03](docs/delivery-reports/HUB-03.md). Consulte [Navegação](docs/architecture/NAVIGATION.md) e [Relatório HUB-03](docs/delivery-reports/HUB-03.md).

## Organização

- `src/app/`: configuração de navegação, dashboard, apresentação e único layout administrativo.
- `src/modules/`: páginas demonstrativas independentes de Social Studio, CRM e Núcleo.
- `src/shared/`: componentes genéricos, tipos e utilidades sem importações de módulos de domínio.
- `src/routes/`: rotas **TanStack** existentes (não criar segundo roteador).
- `src/tests/` e `src/test/`: testes visuais e teste de roteamento já existente.
- `docs/`: arquitetura, decisões, baseline de segurança e relatório da entrega.

O workflow de QA em Chromium é `.github/workflows/browser-qa.yml`: usa Playwright 1.56.1 somente no runner temporário, sem adicionar dependência ou lockfile ao projeto. Testa cinco rotas nas larguras 320, 390, 768, 1280 e 1440 px, grava capturas e publica o artefato GitHub `hub-03-browser-qa` por 14 dias. Para reproduzir localmente com navegador instalado, consulte [Navegação](docs/architecture/NAVIGATION.md).

Consulte [Arquitetura](docs/architecture/ARCHITECTURE.md), [ADR-001](docs/decisions/ADR-001.md), [Segurança](docs/security/SECURITY_BASELINE.md) e [Relatório HUB-02](docs/delivery-reports/HUB-02.md).

## Supabase — fundação documental HUB-04A

O ambiente lógico `levia-hub-dev` foi criado no plano **Free** e região `sa-east-1`, com custo de criação cotado em **US$ 0/mês**. Sua infraestrutura não está conectada à aplicação e **não contém tabelas empresariais**. Consulte [Ambientes e recuperação](docs/architecture/SUPABASE-ENVIRONMENTS.md), [Modelo de acesso](docs/security/ACCESS-MODEL.md), [Plano conceitual de RLS](docs/security/RLS-TEST-PLAN.md) e [Relatório HUB-04A](docs/delivery-reports/HUB-04A.md).

## Restrições

Sem implantação, sem **banco integrado à aplicação**, sem autenticação, sem dados comerciais ou clínicos reais, sem conexão ao site institucional e sem consumo de créditos de IA Lovable. A HUB-04A provisionou somente infraestrutura Supabase Free independente, sem schema empresarial ou uso pela aplicação. O projeto permanece público: revisões devem evitar informações confidenciais em arquivos, PRs, logs e artefatos.
