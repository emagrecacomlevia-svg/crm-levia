# HUB-04B2A-C01 — Auditoria sanitizada de privilégios

**AT-016 | Projeto `levia-hub-dev` | somente metadados SELECT.**

## Método

Consultas estáticas executadas exclusivamente no projeto Supabase
autorizado, limitadas a:

- `pg_catalog.pg_roles` e `pg_catalog.pg_auth_members` para flags e
  associações de papéis.
- `pg_catalog.pg_namespace` e `has_schema_privilege` para schema,
  proprietário e `USAGE`/`CREATE`.
- `pg_catalog.pg_class` mais `has_table_privilege` para a estrutura
  `auth.users` **sem ler usuários**.
- `pg_catalog.pg_default_acl` e `aclexplode` somente para privilégios
  `PUBLIC` e os papéis padrão, sem dados pessoais.
- `current_user` e `current_setting('server_version')`, sem qualquer
  parâmetro de conexão ou valor secreto.

Foram realizadas **zero** instruções remotas DDL/DML ou `SET ROLE`.
O conector não apresentou chave de modo somente leitura explícito;
o escopo foi limitado à consulta textual `SELECT`, revista antes
da execução. Identidade do executor: `postgres` (nome de papel, não credencial).

## Resultado por papel — observado antes da migration

- **`anon`:** herda permissões atribuídas, `BYPASSRLS=false`,
  `USAGE=true` em `auth`/`public`, `CREATE=false`; `auth.users`:
  `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES` falsos.
- **`authenticated`:** mesmas flags e negações para `auth.users`;
  autenticação isolada não concede permissões empresariais.
- **`service_role`:** `BYPASSRLS=true`; `USAGE=true` em `auth` e
  `public`, `CREATE=false`; DML e `REFERENCES` sobre
  `auth.users` falsos segundo `has_table_privilege`.
  **BYPASSRLS não concede por si só privilégios SQL sobre todas as
  tabelas**. A chave correspondente continua proibida no frontend.
- **`postgres`:** não superuser, `BYPASSRLS=true`; `auth.users`:
  `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES` verdadeiros.
  Tem `CREATE` no schema `public`. O executor de migrations futuras
  exige confirmação específica no momento de execução.
- **`authenticator`:** `rolinherit=false`, associado aos papéis
  `anon`, `authenticated`, `service_role` com
  `set_option=true` e `inherit_option=false`.
- **`supabase_auth_admin`:** é o proprietário de `auth.users`;
  esse vínculo não autoriza alterações no schema gerenciado.

## Privilégios padrão e `PUBLIC`

Foram observadas **72 entradas individuais** de
`pg_default_acl` para criadores `postgres` e `supabase_admin`
no schema `public` destinadas a `anon`, `authenticated` e
`service_role`, incluindo operações sobre futuras tabelas,
sequências e rotinas. O filtro utilizado para `PUBLIC` (grantee=0)
e esses três papéis não retornou linhas globais adicionais no
recorte consultado.

**Atenção:** tais privilégios futuros de `public` **não equivalem**
a grants existentes ou futuros de `hub_private`.
`ALTER DEFAULT PRIVILEGES IN SCHEMA hub_private` da candidata afeta
objetos futuros do **papel executor**; não elimina automaticamente
privilégios globais/defaults de todos os outros proprietários.
O schema nem sequer existe no remoto neste momento.

## Resultado dos objetos e barreiras

- `auth.users`: existe, RLS habilitada, owner `supabase_auth_admin`.
- `hub_private`: inexistente — não há ACL, policies, grants nem
  objetos próprios pós-migration para consultar.
- Sem tabelas do HUB em `public`; migration ainda não registrada.
- Configuração de schemas da Data API: **NÃO VERIFICADA**.
- O retorno de `pg_roles`, `pg_auth_members` e
  `has_*_privilege` comprova o estado do catálogo consultado,
  mas não substitui teste de autorização com cliente real após DDL.

## Gate obrigatório para o Consultor

Não homologar segurança pós-migration sem:

1. Evidência de **Exposed schemas** excluindo `hub_private`.
2. Papel executor e `REFERENCES` sobre `auth.users` confirmados
   na operação autorizada.
3. Inspeção de grants herdados/`PUBLIC`, ownership e
   `pg_default_acl` **após criação**, ainda não autorizada.
4. Avaliação explícita do `service_role` real, que pode ignorar
   políticas RLS mas não permissões SQL nem isolamento de schema.
5. Auditoria transacional, LGPD, recuperação e aprovação separadas.

**Conclusão:** inspeção **parcialmente verificada**, sem evidência de
funcionalidade empresarial ou RLS efetiva do futuro schema privado.
