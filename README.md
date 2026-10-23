# LEVIA HUB — LEVIA BIOSCIENCE

Centro administrativo digital da LEVIA BIOSCIENCE.

**Estado:** HUB-02 — fundação técnica demonstrativa. Não é aplicação de produção. Todos os dados apresentados são sintéticos ou textos estáticos. Nenhum módulo de negócio foi implementado.

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
- Nenhuma credencial, serviço externo, Supabase ou variável secreta é necessária para esta etapa.

```bash
git clone https://github.com/emagrecacomlevia-svg/crm-levia.git
cd crm-levia
git checkout feature/hub-02-foundation
bun install --frozen-lockfile
bun run dev
```

Acesse o endereço local indicado pelo Vite. Para verificar:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
```

O CI executa estes comandos sem publicação. `bun run format` **modifica** arquivos; use somente para ajustes locais intencionais.

## Organização

- `src/app/`: composição dos módulos em `config/hub-modules.ts`, apresentação e layout da página inicial.
- `src/modules/`: metadados isolados das áreas planejadas.
- `src/shared/`: UI, tipos e utilidades reutilizáveis, sem dependência de `src/modules/`.
- `src/routes/`: rotas **TanStack** existentes (não criar segundo roteador).
- `src/tests/` e `src/test/`: testes visuais e teste de roteamento já existente.
- `docs/`: arquitetura, decisões, baseline de segurança e relatório da entrega.

Consulte [Arquitetura](docs/architecture/ARCHITECTURE.md), [ADR-001](docs/decisions/ADR-001.md), [Segurança](docs/security/SECURITY_BASELINE.md) e [Relatório HUB-02](docs/delivery-reports/HUB-02.md).

## Restrições

Sem implantação, sem banco, sem autenticação, sem dados comerciais ou clínicos reais, sem conexão ao site institucional e sem consumo de créditos de IA Lovable. O projeto permanece público: revisões devem evitar informações confidenciais em arquivos, PRs, logs e artefatos.
