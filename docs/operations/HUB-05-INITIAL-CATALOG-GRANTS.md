# HUB-05 — Concessão inicial excepcional de capabilities de catálogo

> **LEGADO — NÃO EXECUTAR:** o aprovador da HUB-04 e o administrador principal pertencem à mesma pessoa. A via independente histórica foi substituída operacionalmente por `HUB-05-OWNER-GOVERNANCE.md`. Preserve o texto abaixo somente como histórico técnico; não registrar aprovação independente fictícia.


## Estado do procedimento

O procedimento `hub_private.bootstrap_initial_catalog_grants` é **inerte quando instalado**. Criá-lo não concede capabilities. Sua chamada que insere as duas permissões permanece **PROIBIDA até autorização nominal e específica do responsável LEVIA**. Este documento não equivale à autorização.

## Por que é necessário

A função normal `hub_private.issue_capability_grant` exige `users.manage` **e** que o concedente tenha a mesma capability que delega. Hoje existe um administrador com `core.read` e `users.manage`, mas nenhum `catalog.read` ou `catalog.write`. Fazer concessão normal falharia; fingir um grant por frontend ou ampliar privilégios da HUB-04 seria inseguro.

## Limites codificados

- Apenas executor PostgreSQL `postgres`, em schema privado; `SECURITY INVOKER`; `EXECUTE` revogado de `PUBLIC`, `anon`, `authenticated`, `service_role`.
- Apenas a conta administrativa **já existente, habilitada e única**; não cria usuários nem habilita conta; escopo fixo `module:catalog`, exatamente `catalog.read` e `catalog.write`; prazo obrigatório entre 1 hora e 7 dias.
- Aprovador independente obrigatório e distinto do beneficiário, pertencente a `auth.users`, não excluído, anônimo nem banido, **e o mesmo operador de bootstrap real HUB-04 já registrado nos dois grants de `core.read` e `users.manage`**. Identificação provada por FK, histórico append-only e snapshot do evento original; sintéticos marcados QA não são aceitos.
- Exige justificativa de 30–500 caracteres e referência no formato `LEVIA-HUB05-` + 12–32 caracteres A–Z/0–9.
- Bloqueio de transação `pg_advisory_xact_lock`; recusa qualquer grant de catálogo presente ou histórico, inclusive revogado; recusa segundo bootstrap, impedindo repetição.
- As duas concessões e os dois eventos `grant_created` são atômicos; cada evento identifica approver Auth, `approval_ref`, justificativa, capacidade, escopo, validade e `actor_snapshot` do trigger HUB-04. Se auditoria falhar, nenhum grant persiste.
- **O banco não é capaz de confirmar sozinho a decisão expressa do responsável LEVIA.** `approval_ref` não é segredo nem assinatura. A identidade do aprovador é verificada contra o bootstrap original; a manifestação independente e a autorização do titular devem ser verificadas por canal privado antes da chamada. Um operador `postgres` malicioso é fora do modelo de ameaça dessa ferramenta administrativa.

## Preparação e execução controlada (SOMENTE APÓS autorização específica)

1. Confirmar no registro privado uma autorização do responsável LEVIA que identifique o projeto `levia-hub-dev`, o beneficiário (UUID já existente), o aprovador independente (UUID do bootstrap HUB-04), exatamente as duas capabilities, o prazo e o propósito. Obter e preservar a referência de aprovação. Confirmar aprovador pessoalmente; não deduzir aprovação do UUID.
2. Em sessão PostgreSQL exclusiva, `postgres` e TLS verificado, consultar read-only a conta/actor, grants e auditoria. A aprovação é específica, não inferida da permissão `users.manage`. Nunca encaminhar tokens, senhas ou PII à PR ou CI.
3. Executar somente **uma chamada parametrizada**, sob transação, substituindo os parâmetros após confirmar cada dado com o responsável:
   ```sql
   begin;
   select hub_private.bootstrap_initial_catalog_grants(
     :'approver_uuid'::uuid,
     :'beneficiary_uuid'::uuid,
     :'approval_reference'::text,
     :'reason'::text,
     :'valid_until'::timestamptz
   );
   -- Verificar exatamente 2 grants module:catalog e 2 eventos com approval_ref.
   -- Conferir ator independente, IDs, validade, RLS intacta.
   commit;
   ```
   Não substituir os parâmetros por IDs fictícios. Parâmetros `psql` devem vir do operador autenticado, nunca de um browser.
4. Confirmar leituras no banco após commit, comprovar revogação e expiração em QA operacional, preservar relatório privado de auditoria. **Não renovar pelo bootstrap inicial.** Quando o único administrador perder ambas as concessões por expiração normal, utilizar exclusivamente o [procedimento complementar de renovação com sessão Auth do aprovador independente e nova autorização do responsável](HUB-05-EXCEPTIONAL-RENEWAL.md). Nunca fazer autoatribuição nem extensão automática. A delegação normal continua sujeita à regra de possuir previamente a capability.
5. Autenticar no app com o administrador legitimamente autorizado e verificar `/app/catalog`: consulta, criação DEMO, reload persistente e auditoria com `actor_snapshot` de usuário real. Testar também sem token, revogado, expirado e escopo incorreto. O procedimento não promete executar esses testes sem credenciais e autorização reais.

## Sem atalhos

Não executar `insert into hub_private.permission_grants` diretamente, não usar `service_role`/PostgREST/policy permissiva, não reutilizar `bootstrap_first_admin`, não criar segundo administrador e não registrar consentimento fictício. A instalação da função é independente da concessão. O GitHub Actions executa apenas banco descartável e rollback.

Evidência: `supabase/tests/hub05_first_catalog_bootstrap.sql` e `.github/workflows/hub05-full-auth-qa.yml`.

## Ensaio HTTP real preparado, bloqueado até a concessão

Após a autorização específica e a outorga efetiva, o operador pode executar `node scripts/qa-hub05-authenticated.mjs` com as variáveis `LEVIA_HUB05_EXPLICIT_APPROVAL=SIM`, `LEVIA_HUB05_APPROVAL_REF`, `LEVIA_HUB05_SUPABASE_ORIGIN`, `LEVIA_HUB05_PUBLISHABLE_KEY` e `LEVIA_HUB05_AUTH_BEARER`, definidas localmente num terminal seguro. Não armazenar essas variáveis no GitHub Actions, artefatos nem logs. O script tem destino de projeto **fixo**, valida Auth, tenta leitura anônima/invalid token, consulta via `catalog.read`, cria **um item DEMO persistente** via `catalog.write` e verifica a auditoria com actor e session ID reais. O teste jamais é executado automaticamente em CI. Nele, `reload` significa nova leitura HTTP; o teste visual da rota `/app/catalog` requer ambiente web de desenvolvimento e login do mesmo usuário. Revogação/expiração e escopo incorreto são verificados em PostgreSQL isolado antes de arriscar alterações em concessões reais.
