# LEVIA HUB — HUB-04B2A-C01 — Registro AT-016

**Natureza:** parecer de pré-implantação. Sem aplicação remota, merge,
alteração de configuração ou criação de usuários.

## Identificadores e verificações

- Repo `emagrecacomlevia-svg/crm-levia`, ID `1431576812`.
- Base `main`: `0e043e5bbd664c0ad15804403f524ea9fb1e5e22`;
  árvore `d85b18531f45e33be95c7921d074258389999502`.
- Branch: `feature/hub-04b2a-c01-managed-preflight`.
- Migration existente: blob `7e954d9ce51ce0e3e96021809241a1bb9a439c59`,
  sem modificação.
- Supabase Free de desenvolvimento `levia-hub-dev`, região São Paulo,
  PostgreSQL 17.11, `ACTIVE_HEALTHY`. Zero tabelas em
  `public`/`hub_private`, zero migrations aplicadas.
- Backups Git da `main` auditada (130 arquivos ZIP, bundle de 50
  commits, manifesto e recuperação) permanecem na pasta oficial do
  Drive, verificados por hash e restauração no AT-015.
  **Backup de banco não realizado**.

## Resultado de consultas de metadados

Realizadas exclusivamente instruções `SELECT` sobre catálogos
PostgreSQL e funções de privilégio sem efeitos colaterais.
`auth.users` foi verificada como estrutura, sem consultar linhas.
`postgres` consultado como executor, com `BYPASSRLS=true`;
`service_role` com `BYPASSRLS=true`; `anon` e
`authenticated` sem bypass. Owner de `auth.users`:
`supabase_auth_admin`. O executor `postgres` tem
`REFERENCES` nela. Grants atuais e 72 entradas relevantes de
`pg_default_acl` em `public` foram inspecionados; **não**
comprovam o futuro schema `hub_private`.

## Data API — BLOQUEIO PENDENTE

**NÃO VERIFICADA**: o conector disponível não expõe
`Project Settings → API → Exposed schemas`. Solicitar evidência
restrita ao responsável para confirmar ausência de `hub_private`,
sem capturar chaves ou informações sensíveis.
A inexistência atual do schema não comprova a configuração.

## Isolamento e compatibilidade

A migration original não foi alterada. Preparou-se um segundo QA em
PostgreSQL 17 sem rede, com `service_role BYPASSRLS`, executor
não superuser, tabela Auth fictícia com owner diferente,
falha intencional em transação e marcador de migration **sintético**.
A suíte HUB-04B1 continua cobrindo seus 48 negativos com
um `service_role` **sem** bypass. O segundo QA acrescenta 48
negativas com bypass para demonstrar dependência de ACL/schema.
Nenhum dos dois recria PostgREST, Supabase Auth ou o registro
real da Supabase CLI; **paridade gerenciada NÃO homologada**.

Os testes de isolamento e regressão devem ser confirmados nos
workflows do **HEAD final** do PR antes de alegar sucesso.

## Governança da main

O endpoint de branches confirmou `protected=false`; a listagem
de rulesets estava vazia e a inspeção detalhada via integração
retornou HTTP 403. Segundo a documentação GitHub, regras de
proteção são disponibilizadas para repositórios **públicos** no
GitHub Free; sua configuração depende de permissão administrativa.

Proposta (somente futura, não aplicada): PR obrigatório para `main`;
pelo menos um revisor independente quando conta colaboradora
habilitada; status checks estáveis e exclusivos Quality, SQL e Browser;
proibição de force-push, exclusão e bypass administrativo; tratamento
de emergências com registro de autorização. Revisar gatilhos
condicionais dos workflows para não exigir checks inexistentes.
Se a conta não permitir reviews independentes, manter dois pareceres
fora do GitHub e automatizar CI até regularizar governança.
Nenhum plano pago ou mudança de proteção foi requerido nesta fase.

## Deliberação técnica

**BLOQUEADO para HUB-04B2B nesta análise**, até existir evidência
da Data API, ensaio com paridade satisfatória ou aceite formal da
lacuna, validação pós-DDL dos grants gerenciados, instrumento de
aplicação com semântica transacional e plano de recuperação adequado
para o banco Free.

Não foi executado SQL remoto DDL/DML, migration, alteração de
usuários, políticas ou API; não houve deploy nem acesso a dados
empresariais. Nova autorização independente necessária para
qualquer execução remota.

Arquivos complementares:
[arquitetura](../architecture/SUPABASE-MANAGED-PREFLIGHT.md),
[privilégios](../security/MANAGED-PRIVILEGE-AUDIT.md),
[recuperação](../operations/FIRST-MIGRATION-RECOVERY.md).
