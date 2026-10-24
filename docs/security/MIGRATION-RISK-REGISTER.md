# HUB-04B2A — Registro de riscos da pré-implantação

**Referência:** AT-014. Classificações são análise prospectiva, não
incidentes observados. Sem alterações no Supabase remoto.

## Riscos, controles e decisões

### R01 — Exposição acidental na Data API

- **Gravidade:** crítica. **Estado:** não verificado.
- O schema `hub_private` pode ser exposto por alteração de configuração
  administrativa, ainda que a migration não o solicite.
- **Controle:** comprovar configuração `Exposed schemas` excluindo
  `hub_private`; verificar grants e RLS separadamente.
- **Portão:** bloquear aplicação enquanto a configuração não for
  verificada por meio autorizado de leitura.

### R02 — Papéis gerenciados e bypass de RLS

- **Gravidade:** crítica. **Estado:** não verificado.
- O `service_role` do Supabase não corresponde ao stub PostgreSQL
  `NO BYPASSRLS` do teste; ownership, grants, herança e `PUBLIC`
  podem diferir.
- **Controle:** inspecionar papéis, privilégios efetivos,
  `rolbypassrls`, ownership e `pg_default_acl` antes da implantação.
- **Portão:** auditoria técnica e aceite explícito do responsável.

### R03 — Falta de backup gerenciado no plano Free

- **Gravidade:** alta. **Estado:** risco real do plano.
- O plano Free não oferece backups automáticos gerenciados como os
  planos pagos; uma falha de DDL pode exigir recuperação operacional.
- **Controle:** inventário de estado vazio, backup de código e plano
  de recuperação revisado; definir RPO/RTO antes de dados empresariais.
- **Portão:** sem backup/restore suficiente e aprovação de risco,
  não executar DDL no remoto.

### R04 — Migration parcial, duplicada ou conflitante

- **Gravidade:** alta. **Estado:** possibilidade não testada no gerenciado.
- `CREATE SCHEMA` e `CREATE TABLE` não são idempotentes; histórico de
  migrations e objetos podem divergir após falha ou execução concorrente.
- **Controle:** dry-run, conferência do registro `schema_migrations`,
  janela exclusiva, transação validada em ambiente isolado.
- **Portão:** erro/timeout implica pausa e diagnóstico sem reexecução.

### R05 — Direitos sobre `auth.users`

- **Gravidade:** alta. **Estado:** `auth.users` existe;
  direito `REFERENCES` do executor não verificado.
- **Controle:** aprovar papel executor do DDL e compatibilidade das FKs;
  nunca modificar `auth.users` ou usar credenciais em frontend.
- **Portão:** falta de privilégios implica bloqueio, não improviso.

### R06 — Revogação e rastreabilidade incompletas

- **Gravidade:** alta. **Estado:** limitação confirmada no SQL.
- Grants/contas são removidos por `CASCADE` com exclusão Auth;
  identificadores de ator podem virar NULL. Eventos não são criados
  automaticamente nem protegidos por escritor transacional auditado.
- **Controle:** política de retenção/LGPD, autoria confiável, eventos
  atômicos e controle de exclusões antes de operação real.
- **Portão:** só aprovar cadastro/gestão reais depois desses mecanismos.

### R07 — Escopo demasiadamente amplo

- **Gravidade:** moderada/alta. **Estado:** pendência funcional.
- `scope_kind='module'` não é concessão global implícita, mas cobre
  todo o módulo sem delimitação por carteira ou material.
- **Controle:** revisar escopo mínimo, vigência, papéis de aprovação
  científica/comercial e segregação de funções.
- **Portão:** nenhuma concessão empresarial real nesta etapa.

### R08 — Privilégios padrão de outros donos

- **Gravidade:** alta. **Estado:** não verificado.
- `ALTER DEFAULT PRIVILEGES` cobre o papel executor e pode não
  suprimir grants globais de `PUBLIC` ou grants de outro proprietário.
- **Controle:** inventário de `pg_default_acl` e de novos criadores,
  revisão de futuras migrations antes de adicionar objetos.
- **Portão:** proibir expansão do schema privado sem controle de dono.

### R09 — Proteção de branch e governança

- **Gravidade:** moderada. **Estado:** proteção não verificável.
- Consulta pública aos rulesets retornou lista vazia; endpoint de
  branch protection retornou HTTP 403 para esta integração GitHub.
  Não se deve afirmar que a main está protegida.
- **Controle:** revisão do administrador do GitHub e política de
  PRs com CI/revisões obrigatórias antes de deploy.
- **Portão:** confirmar governança antes de operação remota.

### R10 — Paridade incompleta de ambiente de teste

- **Gravidade:** alta. **Estado:** confirmado.
- PostgreSQL 17 + Auth stub não representa Supabase Auth/PostgREST,
  grants gerenciados, `service_role` real e defaults do projeto.
- **Controle:** ensaio Supabase local ou clone isolado autorizado,
  mais metadados gerenciados por leitura; registrar lacunas.
- **Portão:** nenhuma afirmação de homologação remota sem evidência.

## Decisões obrigatórias

1. Aprovar formalmente projeto/conta de execução e ferramenta fixada.
2. Comprovar exposições da Data API, ownership e privilégios reais.
3. Definir backup/reversão aceitável no Free e limite de perda RPO/RTO.
4. Aceitar política LGPD de evidências e exclusão de Auth.
5. Aprovar segregação de funções, auditoria transacional e bootstrap
   antes de qualquer uso de identidades reais.
6. Autorizar novo parecer AT para HUB-04B2B; nenhuma autorização é
   inferida pela integração do PR atual.

Fontes:
[Supabase API](https://supabase.com/docs/guides/api/securing-your-api),
[schemas](https://supabase.com/docs/guides/api/using-custom-schemas),
[backups](https://supabase.com/docs/guides/platform/backups),
[CLI](https://supabase.com/docs/reference/cli/supabase-db-push).
