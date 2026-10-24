# LEVIA BIOSCIENCE — HUB-04B2B-R01 — Entrega técnica (AT-024)

**Data:** 24/10/2026. **Estratégia:** Alternativa A (maior segurança). **Autorização:** testes isolados e documentação. **Exportação real do Supabase:** NÃO autorizada.

## Identidade e checkpoint

- Repositório `emagrecacomlevia-svg/crm-levia` (GitHub ID `1431576812`).
- `main` de origem: `8e0bf341549029813bb9ac2d49b59af28919d79e`; PR #7 já integrado.
- Branch R01: `feature/hub-04b2b-r01-recovery-validation`.
- PR [Draft #8](https://github.com/emagrecacomlevia-svg/crm-levia/pull/8), **sem merge**.
- Migration candidata intocada: `supabase/migrations/20261024130000_identity_permissions.sql`.
- Blob Git da migration: `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
- Supabase por leitura inicial: `levia-hub-dev`, `dfhjfajbmnsgrklhqtjk`, `sa-east-1`, PostgreSQL 17.11, Free, `ACTIVE_HEALTHY`, zero tabelas próprias e migrations remotas. Não houve gravação de nenhum tipo.
- Backups históricos de Git recuperáveis e mantidos na pasta oficial: https://drive.google.com/drive/folders/1x2_8sRhHPrC0dfTuUhS07KvmRGGuMAT7 . **São backups do Git, não do PostgreSQL.**

## Artefatos entregues

- `docs/operations/DATABASE-BACKUP-PLAN.md` — cobertura e exclusões, regras do dump, instrumento futuro, autorização específica.
- `docs/operations/DATABASE-RESTORE-TEST.md` — fixtures, verificação, falhas simuladas e limites.
- `docs/security/BACKUP-ACCESS-AND-RETENTION.md` — custódia, criptografia, acesso, retenção e descarte.
- `docs/delivery-reports/HUB-04B2B-R01.md` — este relatório.
- `scripts/qa-database-recovery-r01.sh` — simulação sintética com proteção contra uso remoto.
- `.github/workflows/hub-04b2b-r01-recovery-qa.yml` — GitHub Actions temporário com `permissions: contents: read`, sem credenciais remotas e sem publicação de dumps.

Os documentos históricos `FIRST-MIGRATION-RECOVERY.md` e `RECOVERY-RUNBOOK.md` foram consultados, mas preservados sem reescrita.

## CLI oficial e comandos

- Versão pinada `supabase 2.122.0` na release oficial, binário Linux AMD64 validado com `checksums.txt` e `sha256sum -c`.
- `supabase db dump --help` confirmado no runner. Flags suportadas: `--db-url`, `--schema`, `--file`, `--data-only`, `--use-copy`, `--role-only`, **`--dry-run`**. Diferente de `db push`, `db dump --dry-run` mostra o script `pg_dump`; comprovado sem criar arquivo.
- O CLI executa `pg_dump` por Docker. No Linux runner, foi necessário `--network-id host` para permitir que o contêiner temporário do cliente alcance PostgreSQL no loopback `127.0.0.1:55443`.
- Sem `--skip-vault`: essa flag foi homologada para `db push`, não se aplica ao instrumento de dump.
- Sem `supabase link`, tokens, passwords, segredos no GitHub ou endpoints do Supabase LEVIA.

Documentação oficial consultada:

- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/backups

## Evidências de exportação e restore isolados

**Execução de homologação do script:** commit `80f824c6e0adfdec98c6f4bc6929b78968d4a8f9`, [run #40121785936 — SUCCESS](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40121785936). Os resultados do **HEAD final do PR** serão identificados de forma independente, sem reaproveitar uma execução antiga como aprovação do novo HEAD.

No PostgreSQL 17 descartável e exclusivamente sintético foram verificados:

1. Schema de laboratório com duas tabelas, 2 pessoas sintéticas e 3 eventos sintéticos, FK/UNIQUE/CHECK, índice, RLS, política SELECT e ACL restritiva.
2. `supabase db dump --dry-run` mostrou o plano sem escrever arquivo.
3. `supabase db dump` gerou `schema.sql` e `data.sql` separados com filtro explícito de schema.
4. Os dois arquivos passaram na comparação SHA-256.
5. Envelope GPG AES256 com senha aleatória efêmera separada, cifra/decifra, validação SHA-256 do ciphertext e comparação byte a byte.
6. `psql --single-transaction --set ON_ERROR_STOP=1` restaurou em banco temporário separado.
7. As duas tabelas, dados, FK, índices, RLS/política, grants e fingerprints determinísticos coincidiram.
8. Conteúdo adulterado e exportação interrompida/truncada foram detectados por mismatch de checksum.
9. SQL corrompido provocou erro e rollback; schema não ficou parcialmente criado.
10. Schema restaurado sem dados retornou exit code zero, mas foi **rejeitado pelo controle de completude**.
11. Dados importados sem tabelas dependentes falharam adequadamente.
12. Dump contendo role inexistente foi rejeitado com rollback.

Os SQLs sintéticos, a chave efêmera e o ciphertext não foram publicados nem preservados como artefatos. A saída final do workflow identifica explicitamente ausência de dump remoto e de uso de credenciais.

## Cobertura, exclusões e lacunas

**Código Git:** já possui backup completo independente, não substitui banco.

**Banco próprio:** o ensaio restaura apenas `hub_recovery_lab`, não o schema candidato `hub_private`. O schema `hub_private` ainda não existe no Supabase LEVIA. A migration própria referencia `auth.users` gerenciado; não foi provado restore real dessas dependências. Políticas e grants devem ser verificados para cada destino; roles de laboratório são criadas como fixtures, não recuperadas do dump.

**Infraestrutura Supabase:** o dump oficial filtra por padrão schemas gerenciados `auth` e `storage`, schemas de extensões; dump de schema padrão não inclui dados nem roles. Um dump SQL **não** recupera configurações da Data API, segredos, chaves, provedores Auth, dados de objetos físicos do Storage, Realtime e serviços de controle. O histórico de `supabase_migrations.schema_migrations` exige inventário e decisão específica de preservação, nunca criação sintética apresentada como CLI real.

**Plano Free:** não há garantia de PITR, recuperação integral de objetos gerenciados, RPO ou RTO. A Alternativa A mitiga riscos de objetos exportáveis, mas não elimina as limitações da plataforma.

## Segurança e autorização futura

Futura exportação real **depende de novo parecer específico** que fixe escopo, finalidade, custódia, janela, executor, credencial temporária via canal privado, instrumento/versionamento, preservação do ciphertext em repositório restrito, chave segregada, hash após download e restauração em ambiente isolado com critérios de aceite. URLs com senhas nos argumentos de processos podem vazar; nenhum método de injeção de credenciais para dump real foi homologado na R01. Não fornecer senhas nesta conversa.

O plano propõe destruição controlada de arquivos temporários e requisitos de retenção aprovados; o ensaio sintético não substitui a custódia real.

## Data API e portões remanescentes

O responsável mostrou `graphql_public` e `public` como únicos schemas expostos e o toggle `Automatically expose new tables` desligado. **Ainda está pendente** a prova persistida do estado após **Save + reabertura**. Nenhuma configuração foi modificada.

**Classificação para exportação real: BLOQUEADA na autorização AT-024.** Instrumento de recuperação isolada validado; falta autorização formal de dump, avaliação suficiente da cobertura pre-migration, processo seguro de credenciais, retenção e Data API confirmada. Aplicação da migration SQL continua proibida e requer autorização independente posterior.

## CI e governança

Runs antigos não são resultados do HEAD final. Conferir no PR os workflows R01 Recovery QA, Managed Preflight, Quality e Browser QA. SQL QA HUB-04B1 só será listado como executado se tiver sido acionado pelos filtros `paths`.

**Nenhum merge, nenhum deploy, nenhum SQL DDL/DML ou dump no projeto remoto, nenhuma criação de projeto Supabase ou alteração de Vault/Auth/Storage/Data API/Cloudflare/Lovable foi executada.**

**LEVIA HUB — HUB-04B2B-R01 — Procedimento de Backup e Recuperação Testado em Ambiente Isolado — Aguardando Auditoria e Autorização de Exportação Real.**
