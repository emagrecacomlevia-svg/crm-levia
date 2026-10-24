# LEVIA HUB — HUB-04B1: relatório de implementação candidata

**Parecer:** AT-011. **Estado:** aguardando auditoria, PR Draft; nenhuma aplicação remota.

## Escopo e base

- Repositório: `emagrecacomlevia-svg/crm-levia` (GitHub ID `1431576812`).
- Base auditada da `main`: `8466e8b41356c0a3c27737683fb7e596099c790d`.
- Branch exclusiva: `feature/hub-04b1-identity-schema`.
- Projeto Supabase de desenvolvimento observado por metadados, em **leitura**:
  `levia-hub-dev`, `sa-east-1`, `ACTIVE_HEALTHY`. Não executar SQL remoto.
- Branch, HEAD final, commits e PR: preencher com evidência final, sem previsão.

## Implementado no repositório, não no banco remoto

- Migration candidata `supabase/migrations/20261024130000_identity_permissions.sql`:
  schema `hub_private`; quatro tabelas (`admin_accounts`, `capabilities`,
  `permission_grants`, `permission_audit_events`), nove capacidades e índices
  limitados.
- Negação por padrão: RLS nas quatro tabelas, nenhum `CREATE POLICY`, revogação
  de schema/tabelas para `PUBLIC`, `anon`, `authenticated` e `service_role`.
- FKs para Auth somente pela PK `auth.users.id`, sem alterações nesse schema.
- Constraints de conta desabilitada, vigência, escopo tipado, não autoatribuição
  e unicidade parcial de concessões não revogadas.
- Testes PostgreSQL em contêiner local descartável, sem acesso à rede, e
  verificação estática de invariantes; nenhuma conta Auth real usada.

## Limitações importantes e bloqueios

- A CLI Supabase não estava instalada no ambiente de autoria. O arquivo tem
  nomenclatura oficial candidata, não foi gerado pelo comando `migration new`.
- Não existem políticas positivas nem caminho de administração de usuários.
  Um login futuro com JWT válido **não** recebe acesso empresarial.
- Sem escritor transacional de eventos: a tabela de auditoria foi preparada,
  mas concessões/revogações **não registram eventos automaticamente**.
- Os testes positivos de usuário autorizado, RLS por entidade CRM/editorial,
  desativação com sessão em vigor e auditoria imutável estão **pendentes**.
- Nenhuma credencial, login, dado pessoal, produto, cliente, receita ou
  armazenamento de documentos foi incluído.
- Não há migrations de tabelas CRM, Social Studio, views, Edge Functions,
  triggers em Auth ou conexão frontend.
- Scripts SQL desse PR não são autorização para deploy.

## Verificações e CI

A preencher estritamente após executar os workflows no GitHub. A execução
local de PostgreSQL não estava disponível no ambiente de autoria; os testes
estão preparados para GitHub Actions gratuito em container efêmero.

## Critérios antes de qualquer execução remota futura

1. Nova autorização expressa; revisão dos códigos de capacidade, escopos e
   política de retenção da trilha e exclusão de identidades Auth.
2. Plano de bootstrap, concedente confiável, autorizações independentes,
   writer privilegiado, revogação e auditoria atômica; revisão de qualquer
   `SECURITY DEFINER` se eventualmente necessário.
3. Verificação de compatibilidade com Supabase real (diferente do stub local),
   GRANTs existentes, schemas expostos, backups e estratégia de reversão.
4. Homologação de testes com RLS positiva e acesso por usuário/escopo em
   ambiente autorizado futuro; testes negativos de JWT e desativação.
5. Decisão e autorização do Consultor e do responsável antes do merge, da
   aplicação da migration e da HUB-04B2.

Fontes oficiais: [Auth](https://supabase.com/docs/guides/auth/managing-user-data),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[CLI](https://supabase.com/docs/reference/cli/global-flags).
