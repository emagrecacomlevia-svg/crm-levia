# LEVIA HUB — HUB-04B1: relatório de implementação candidata

**Parecer:** AT-011. **Estado:** aguardando auditoria, PR Draft; nenhuma aplicação remota.

## Escopo e base

- Repositório: `emagrecacomlevia-svg/crm-levia` (GitHub ID `1431576812`).
- Base auditada da `main`: `8466e8b41356c0a3c27737683fb7e596099c790d`.
- Branch exclusiva: `feature/hub-04b1-identity-schema`.
- Projeto Supabase de desenvolvimento observado por metadados, em **leitura**:
  `levia-hub-dev`, `sa-east-1`, `ACTIVE_HEALTHY`. Não executar SQL remoto.
- Pull Request Draft: https://github.com/emagrecacomlevia-svg/crm-levia/pull/4.
- Commits rastreados antes da atualização final deste relatório:
  `083cde65db52abe6e5cf7b63d7d54047c7e3a173` (migration e testes);
  `23778aa627c05584f6af2e83ff709c7038cd520e` (Prettier JavaScript);
  `ebf386212563d08565f71d3e4a0fbad8308f88fa` (entrada SQL do teste);
  `3215a0f2377cb4257a5da9b0fb2eb25e43b992c5` (diagnóstico de formato);
  `fabbf65b08d5ebf0f2affcba07317953214e74b8` (guia);
  `308e8d4f1f675beaafcff1594bda1333c77b1769` (evidências CI).
  O SHA da versão final é o HEAD visível no PR; não registrar uma previsão
  circular do hash do próprio commit do relatório.

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

- **Local no ambiente de autoria:** verificador estático Node passou. CLI
  Supabase e serviço PostgreSQL local não estavam instalados; por isso a
  migração não foi gerada por CLI e o teste de banco local foi executado no
  runner temporário do GitHub, **não no banco Supabase**.
- **Quality CI aprovado:**
  https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40097017024
  — Bun com lockfile congelado; lint com **0 erros e 6 avisos herdados**,
  formatação, geração de rotas, build, typecheck e **22 testes Vitest**.
- **SQL QA aprovado:**
  https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40097017017
  — PostgreSQL 17 descartável com `--network none`, schema Auth de teste,
  execução real de DDL, verificações RLS/ACL, FK, unicidade, janelas de
  vigência e autoatribuição. Banco descartado após os testes.
- **Browser QA aprovado:**
  https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40097017022
  — regressão visual e navegação da interface demonstrativa preservada.
- **Histórico de correção do CI:** primeiros jobs falharam por Prettier no
  verificador JavaScript, omissão do `-i` em `docker exec` para alimentação
  do schema de teste e formatação do guia Markdown. As correções foram
  versionadas na mesma branch, sem alteração da migration SQL.
- **Limitação de prova:** um teste em PostgreSQL genérico com Auth simulado
  não verifica integração, autenticação nem enforcement positivo de RLS em
  Supabase; a etapa remota continua proibida e não foi testada.

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

## HUB-04B1-C01 — correções AT-012 para auditoria

- **A, exclusão:** mantidos CASCADE e SET NULL, com teste de identidades sintéticas em PostgreSQL isolado. Exclusão de beneficiário elimina conta e grants; exclusão de ator torna referências nulas. Um evento de auditoria criado manualmente permanece com UUIDs históricos. Não há auditoria automática; retenção, LGPD e reconciliação bloqueiam uso real.
- **B, tempo:** CHECK `grant_revocation_not_before_grant` adicionado; permite nulo e data posterior/igual à concessão sem impedir `valid_from` futuro. Negativos exigem rejeição de revogação anterior, janelas iguais/invertidas e revogador sem data.
- **C, acesso:** 48 tentativas SQL reais exigem SQLSTATE 42501; 48 ACLs individuais, RLS e policies conferidas. GRANT temporário somente no teste isolado distingue negação por ACL de deny-all RLS. Stub `service_role` não equivale ao serviço gerenciado.
- **D, ator:** desigualdade de UUID armazenado não comprova identidade; campos NULL podem resultar de exclusão de Auth/legado, não autorizam concessão sem autoria.

**Status técnico:** candidato não aplicado remotamente. Resultados do SQL QA, Quality CI e Browser QA devem ser registrados depois de efetivamente observados no HEAD da correção. Sem merge, SQL remoto, usuário real ou avanço HUB-04B2. A `main` auditada deve continuar em `8466e8b41356c0a3c27737683fb7e596099c790d`.

**Pendências bloqueantes:** consentimento/política de retenção de evidências, privacidade, writer confiável e auditável, teste de segurança em Supabase gerenciado, segregação, política RLS positiva e recuperação/reversão.
