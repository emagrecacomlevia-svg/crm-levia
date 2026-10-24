# HUB-04B2A-C01 — Homologação gerenciada pré-implantação

**AT-016 | Exclusivamente metadados remotos SELECT e testes locais isolados.**

## Escopo e checkpoint

- Repositório: `emagrecacomlevia-svg/crm-levia` (ID `1431576812`).
- Base da `main`: `0e043e5bbd664c0ad15804403f524ea9fb1e5e22`.
- Árvore base: `d85b18531f45e33be95c7921d074258389999502`.
- Migration **intocável**: `supabase/migrations/20261024130000_identity_permissions.sql`.
- Git blob auditado: `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
- Projeto de desenvolvimento Supabase Free exclusivo da LEVIA: `levia-hub-dev`,
  `sa-east-1`. Seu identificador administrativo está no relatório privado,
  não é necessário para reproduzir testes públicos.

## Metadados constatados por leitura em 24/10/2026

As consultas ao projeto explicitamente autorizado executaram apenas `SELECT` e
não acessaram linhas de `auth.users`, chaves, senhas ou tokens.

- PostgreSQL `17.11`, `server_version_num=170011`; executor `postgres`.
- `auth.users` existe e tem owner `supabase_auth_admin`; RLS habilitada.
- `hub_private` **ainda não existe**; `public` não contém tabelas do HUB.
- A listagem de migrations remotas continua vazia.
- `postgres`: `rolsuper=false`, `rolbypassrls=true`, `rolcreaterole=true`,
  `rolcreatedb=true`; na tabela `auth.users`, inclui `REFERENCES=true`.
- `anon` e `authenticated`: `rolbypassrls=false`.
- `service_role`: `rolbypassrls=true` (diferença **verificada** em relação
  ao stub do QA antigo); não tem login direto nem privilégios de DML em
  `auth.users` pelo resultado de `has_table_privilege`.
- Os papéis de cliente testados têm `USAGE=true` nos schemas gerenciados
  consultados e em `public`, mas `CREATE=false`; `USAGE` não concede
  acesso a linhas de uma tabela.
- `authenticator` tem associações com `anon`, `authenticated` e
  `service_role` usando `set_option=true` e `inherit_option=false`.
- `pg_default_acl`: privilégios pré-configurados para objetos futuros em
  `public`, sob `postgres` e `supabase_admin`, incluindo tabelas,
  sequências e rotinas para clientes. Não há entrada de `hub_private`
  porque o schema inexiste. Isso **não** determina ACL da futura migration.
- O endpoint GitHub `main` informa `protected=false`; os rulesets
  públicos retornaram lista vazia; a consulta de detalhes de proteção
  retornou 403 para a integração.

A matriz sanitizada e os limites das consultas encontram-se em
[MANAGED-PRIVILEGE-AUDIT](../security/MANAGED-PRIVILEGE-AUDIT.md).

## Exposed schemas — Data API

**Estado: NÃO VERIFICADO**. As ações de leitura do conector Supabase
atualmente disponíveis não retornam a lista administrativa de schemas
expostos no PostgREST/Data API. Não foi fornecida captura do painel.

**Evidência privada solicitada:** o responsável deve abrir o dashboard
Supabase do projeto correto, navegar a **Project Settings → API →
Exposed schemas** (o nome da seção pode variar) e confirmar por escrito
a lista ou encaminhar somente captura recortada desse campo, ocultando
chaves, tokens e URLs sensíveis. Registrar data e origem da evidência.

**Portão obrigatório para a futura aplicação:** comprovar diretamente
ou por captura do painel que `hub_private` **não aparece** na lista.
Não inferir ausência de exposição pelo fato de não existir tabela ou schema.

## Comparação: ambiente real versus ensaio isolado

- **Auth:** `auth.users` pertence a um proprietário gerenciado; no ensaio, a tabela é
  sintética e seu proprietário também é separado do executor.
- **Executor:** `postgres` remoto não é superuser e tem `BYPASSRLS`; o ensaio utiliza
  um executor sem superuser e reserva um superuser apenas para a preparação descartável.
- **`service_role`:** tem `BYPASSRLS=true` no remoto e na nova simulação; a suíte
  anterior usava um stub `NO BYPASSRLS`.
- **Herança:** associações de papéis reais foram consultadas, mas só parte é simulada.
- **Privilégios padrão:** grants no `public` remoto sob dois proprietários; o teste
  avalia a ACL do schema novo, criada pelo executor isolado.
- **Data API:** ainda não comprovada no Dashboard; PostgREST não roda na simulação.
- **Histórico:** nenhuma migration remota; marcador local sintético, não CLI Supabase.
- **Transação/falha:** não ensaiadas remotamente; cenários de commit e rollback locais.
- **Gerenciados:** Auth, Storage e Realtime remotos não são reproduzidos integralmente.

O cenário isolado **não tem paridade integral com Supabase gerenciado**.
O QA existente (48 negativas, PostgreSQL 17 com stub) permanece válido
dentro de seu escopo. O novo QA utiliza um segundo perfil experimental com
`BYPASSRLS` real e executor de migration limitado.

## Procedimento de verificação em uma futura etapa autorizada

1. Conferir projeto, organização, estado, versão, SHA `main`, blob SQL,
   backups e aprovação formal de aplicação.
2. Confirmar **Data API Exposed schemas**, roles herdados, ownership,
   `PUBLIC`, `pg_default_acl` e privilégios dos novos objetos.
3. Validar instrumento/versão CLI e semântica de transação e versionamento
   em ambiente isolado fiel. Não improvisar `migration repair`.
4. Executar somente após parecer próprio da HUB-04B2B.
5. Pós-aplicação: confrontar quatro tabelas, nove capacidades,
   FKs, RLS, zero policies positivas, ACL efetivas e histórico; escritas
   de teste e usuários sintéticos ainda requerem autorização separada.

## Fontes primárias

- [Supabase — schemas personalizados](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase — papéis](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — migrations](https://supabase.com/docs/guides/local-development/database-migrations)
