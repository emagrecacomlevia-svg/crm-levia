# HUB-04B2A — Pré-implantação da migration de identidades

**Etapa:** HUB-04B2A (AT-014). **Natureza:** análise e plano, sem execução
remota. O arquivo SQL auditado permanece inalterado.

## Identidade e ponto de controle

- Repositório: `emagrecacomlevia-svg/crm-levia`, ID `1431576812`.
- Base da `main`: `bff465997ff357bb8e79cf100bacd23ab0cb1e35`.
- Árvore Git de origem: `cc74d30bd2b12a582b0b3469c575e33129c68fa3`.
- Migration: `supabase/migrations/20261024130000_identity_permissions.sql`.
- Git blob auditado da migration: `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
- Projeto lógico: `levia-hub-dev`; ambiente de desenvolvimento Free,
  separado do site institucional, QR e projetos externos.
- As configurações reais e credenciais do projeto não estão neste documento
  público.

## Inventário remoto — somente leitura

Metadados consultados na conexão aprovada em 24/10/2026:

- Banco PostgreSQL `17.11.0.003`, engine 17, canal GA.
- Região `sa-east-1`; estado `ACTIVE_HEALTHY`.
- Em `public` e `hub_private`: **zero tabelas**; lista de migrations: **vazia**.
- Em schemas gerenciados consultados (`auth`, `storage`, `realtime` e
  `extensions`): **38 tabelas** visíveis; `auth.users` foi identificada.
  A contagem não é um inventário completo de todos os schemas PostgreSQL.
- Catálogo de extensões acessíveis: 78 entradas; `plpgsql` 1.0,
  `pg_stat_statements` 1.11 e `supabase_vault` 0.3.1 aparecem instaladas.
  Disponibilidade não significa extensão instalada. Não foi necessário
  instalar `pgcrypto`: `gen_random_uuid()` existe no PostgreSQL recente.
- Advisors de segurança e desempenho: zero lints retornados. Ausência de
  avisos não equivale a auditoria integral de papéis ou exposição de schemas.
- **Não verificado:** lista real de schemas expostos no Data API/PostgREST,
  privilégios efetivos e herança dos papéis gerenciados, proprietário de
  objetos, `pg_default_acl` e `rolbypassrls` remoto. As ferramentas
  de leitura disponíveis não fornecem esses detalhes. Não usar SQL remoto
  para obtê-los nesta etapa.

## Compatibilidade: dependências e riscos

1. **`auth.users` e FKs:** a tabela gerenciada existe; `admin_accounts`
   aponta apenas para sua PK. Não modifica o schema `auth`. Confirmar
   `REFERENCES` e direitos de criação do executor no ambiente gerenciado.
   Exclusões de Auth podem apagar conta e grants por `CASCADE`, enquanto
   referências de ator podem virar NULL. Auditoria é apenas armazenamento
   manual; LGPD e retenção seguem bloqueantes para uso real.
2. **UUID:** `gen_random_uuid()` disponível no PostgreSQL 17. A posição
   no `search_path` deve ser verificada localmente com o executor real;
   evitar alterar `search_path` remoto nesta avaliação.
3. **Schemas/roles:** `create schema hub_private` requer permissão de
   criação; roles `anon`, `authenticated` e `service_role` devem existir
   quando o SQL for aplicado. O schema deve permanecer fora da lista
   **Exposed schemas** em API Settings.
4. **ACL:** `REVOKE` do schema, tabelas, sequências e rotinas nega
   privilégios explícitos, mas deve ser avaliado juntamente com herança
   de roles, `PUBLIC`, grants por coluna e ownership. Propriedade de
   objetos pode conceder administração independente de GRANT.
5. **Default ACL:** `ALTER DEFAULT PRIVILEGES IN SCHEMA` aplica-se às
   futuras criações **pelo papel executor**, não automaticamente a todos
   os donos futuros. Revogação por schema pode não neutralizar concessões
   globais preexistentes a `PUBLIC`. Registrar executor e inspecionar
   `pg_default_acl` antes de liberar qualquer outro criador.
6. **RLS:** as quatro tabelas recebem RLS; não há `CREATE POLICY`.
   `authenticated` não recebe permissão empresarial por possuir sessão.
   RLS determina linhas acessíveis **após** privilégio SQL; é distinto
   do erro `42501` causado por ausência de USAGE/GRANT.
7. **Service role:** o papel sintético do QA é **NO BYPASSRLS**; o
   `service_role` gerenciado tem privilégios elevados e pode contornar
   RLS. A prova local de 48 negativas não demonstra comportamento real
   desse papel. Nunca usar chave privilegiada no navegador nem em artefatos.
8. **Integridade:** o índice único parcial limita uma concessão ainda
   não revogada por (sujeito, capacidade, tipo de escopo, chave).
   `valid_until > valid_from` e `revoked_at >= granted_at` são
   verificações de dados, não autorizações. Concessões com validade
   agendada são permitidas. O escopo `module` é amplo dentro do módulo
   e requer decisão de governança.
9. **Autoria:** UUID distinto do beneficiário não autentica o concedente.
   Atores NULL só representam casos legados/exclusão do Auth, não liberam
   concessões empresariais sem responsabilidade comprovada.
10. **Reexecução:** `CREATE SCHEMA`/`CREATE TABLE` sem `IF NOT EXISTS`
    não é idempotente. Não repetir a migration após erro ou timeout sem
    conciliar catálogo e histórico. A atomicidade de todos os comandos
    depende do instrumento de aplicação e transação efetivamente usados,
    a confirmar em simulação isolada.

Referências oficiais:

- [Supabase — schemas personalizados](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase — segurança da Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — gestão de usuários](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase — migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [CLI — db push](https://supabase.com/docs/reference/cli/supabase-db-push)

## Roteiro para eventual HUB-04B2B — **não executar agora**

**Portão 0 — autorização:** Consultor e responsável devem aprovar nova
operação, plano de recuperação e instrumento. Uma versão diferente do SQL,
uma alteração na `main` ou outro projeto invalida o plano.

**Portão 1 — verificação de alvo:**

1. Conferir ID e nome do projeto por consulta aprovada, organização,
   região, estado e engine; recusar ambiente diferente.
2. Conferir SHA Git e Git blob da migration; exigir coincidência com
   `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
3. Checar zero tabelas em `hub_private`, migrations não aplicadas e
   ausência de modificações concorrentes.
4. Conferir no painel/API autorizada **Exposed schemas**; exigir ausência
   de `hub_private`. Inspecionar ownership, `PUBLIC`, herança, roles
   `service_role`, default ACL e direitos `REFERENCES` do executor.
5. Confirmar backup de código atualizado ao HEAD imediatamente anterior,
   inventário e recuperação do banco antes de execução; sem backup Free
   garantido, exigir aceite explícito do risco.
6. Validar transação e testes em clone local fiel ou equivalente isolado.
   Proibir SQL de conveniência ou correções improvisadas durante o deploy.

**Portão 2 — aplicação futura aprovada:** sugerir CLI Supabase em versão
fixada, com identidade e autorização confirmadas em ambiente seguro,
revisão de `supabase db push --dry-run` e, **somente após autorização
HUB-04B2B**, execução controlada de `supabase db push`. O CLI registra
versões em `supabase_migrations.schema_migrations`. Não guardar token,
connection string ou senha em repositório/log. Nunca usar `migration
repair` sem parecer formal.

**Portão 3 — pós-aplicação:** executar checklist abaixo inicialmente só
por metadados. Testes com DML/usuários sintéticos exigem autorização
separada e não fazem parte de HUB-04B2A.

**Erro/timeout:** interromper, preservar logs sem segredos, consultar
objetos e versões antes de qualquer retry; escalar ao Consultor. Não
rodar `DROP` ou correção ad hoc. Seguir
[runbook de recuperação](../operations/RECOVERY-RUNBOOK.md).

## Checklist pós-migration (futuro)

**Somente leitura:** quatro tabelas, nove códigos de capacidades, FKs,
checks, índices, RLS ativa, `pg_policies` sem regras positivas, grants
por role e `PUBLIC`, schemas expostos, nome do dono, histórico de
migration, objetos gerenciados inalterados e estado saudável.

**Dependente de escrita/autorização específica:** tentativas negativas
por `anon` e `authenticated`, DML no escopo privado com identidades
de teste, verificações de conta inativa/revogação e consulta a eventos.
Nenhum teste de RLS positiva é possível enquanto não houver políticas
positivas. Não usar perfis reais.

## Verificação isolada executada / pendente

A suíte existente em `.github/workflows/identity-sql.yml` utiliza
PostgreSQL 17 descartável e um stub de Auth. Ela verifica 48 negativas
de DML, constraints e ausência de policies, não a configuração de um
Supabase gerenciado. O seu resultado nesta entrega deve ser observado
no PR Draft antes de alegar sucesso. A CLI e stack Supabase local
completa **não** foram executadas nesta etapa, por indisponibilidade de
Docker e do CLI no ambiente de autoria. Não alegar paridade com o remoto.
