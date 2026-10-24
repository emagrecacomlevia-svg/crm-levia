# HUB-04B2B-R01 — Plano de exportação lógica controlada (AT-024)

**Estado:** procedimento projetado; apenas ensaio sintético autorizado. **Não existe backup lógico real do Supabase LEVIA**. Não executar `supabase db dump` no remoto sem nova autorização específica.

## Objetivo, destino e premissas

- Repositório oficial: `emagrecacomlevia-svg/crm-levia` (ID `1431576812`).
- Checkpoint de origem: `8e0bf341549029813bb9ac2d49b59af28919d79e`.
- Projeto futuro, sujeito a autorização: `levia-hub-dev` (ref `dfhjfajbmnsgrklhqtjk`, `sa-east-1`, PostgreSQL 17.11, Free).
- Não criar projeto Supabase adicional, serviço pago, database empresarial ou papel privilegiado.
- O banco tem zero migrations remotas e nenhum objeto empresarial próprio. O schema `hub_private` ainda não existe. Portanto, **não é possível afirmar que um dump desse schema vazio antes da primeira migration proteja os objetos gerenciados**.

## Três domínios de recuperação diferentes

1. **Código e migrations:** o bundle Git e o ZIP do checkpoint AT-023 preservam arquivos e histórico, mas **não** conteúdo, papéis, configurações ou estado do PostgreSQL.
2. **Objetos LEVIA autorizados:** schemas particulares, tabelas, índices, constraints, RLS, políticas, dados, grants, owners/default ACL; só serão recuperáveis **naquilo que o dump incluir e a restauração validar**. Em `hub_private`, FKs para `auth.users` impõem dependência gerenciada na restauração. O registro `supabase_migrations.schema_migrations` deve ser inventariado separadamente e **não reconstruído manualmente** como se fosse histórico real.
3. **Plataforma gerenciada:** um dump com filtro Supabase exclui por padrão schemas internos como `auth`, `storage` e extensões. Dump normal é de schema, **não** inclui dados ou roles personalizados sem opções específicas. Objetos físicos do Storage, Auth providers, Vault, secrets, chaves, configuração da Data API, SMTP, Edge Functions, Realtime, rede e demais metadados/control-plane não são restaurados integralmente por esse procedimento. Não copiar schemas gerenciados sem justificativa e autorização independente.

Fontes oficiais consultadas:

- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/backups

A documentação de backups Supabase informa que backups gerenciados diários se aplicam aos planos Pro, Team e Enterprise; o Free deve manter backups externos. A recuperação integral gerenciada, RPO, RTO e PITR **não estão garantidos**.

## Instrumento em homologação isolada

- Fixar **Supabase CLI v2.122.0**, distribuída em https://github.com/supabase/cli/releases/tag/v2.122.0; validar `checksums.txt` e a saída de `supabase --version`.
- Confirmar `supabase db dump --help`, inclusive `--db-url`, `--schema`, `--file`, `--data-only`, `--use-copy`, `--role-only`; verificar `--dry-run` em vez de presumir que exista.
- `--skip-vault` pertence ao **db push**; **não transferir** esse parâmetro para `db dump`.
- CLI realiza `pg_dump` em Docker; requer imagem e conectividade verificadas. `psql` da versão compatível executa o restore. Versões e imagens do destino real precisam ser fixadas por instrumento auditado.
- No ensaio, `--db-url` aponta exclusivamente ao loopback `127.0.0.1:55443` sem segredos; nunca configurar link/token/projeto remoto no runner de GitHub.
- Em exportação futura, nunca confundir `--role-only` com senha/credores ou com um backup integral do plano de controle.

## Roteiro PROPOSTO para exportação real — não executar na R01

1. Receber nova autorização nominal, por projeto, schemas, horários, executor, retenção, tipo de credencial e cobertura. Consultor confirma que a fonte de backup é suficiente para o risco da primeira migration e que ainda não existe `hub_private`.
2. Selecionar workstation privada e isolada ou runner **não público**, sem logs de comandos/variáveis, shell tracing, artefatos CI ou monitoramento capturando URLs. Não usar GitHub Actions para conexão ou armazenamento de credenciais reais.
3. Operador obtém acesso temporário por canal da organização, **fora do chat**, de um segredo já existente; conferir a conexão de maneira segura, sem registrar credenciais, strings de conexão completas nem argumentos sensíveis em histórico/listagens de processos. Antes da autorização, homologar técnica específica de passing de credenciais (risco de URI em `argv`, pgpass/containers e logs).
4. Reconfirmar projeto/ref, versão PG, papéis, schema/objetos, `supabase_migrations`, RLS, ACL, extensões, Data API, usuários/Storage apenas por inventário de metadados conforme autorização. Não presumir que o Free permite snapshots gerenciados.
5. Fixar schemas autorizados **explicitamente**; confirmar se a estratégia realmente cobre objetos/dados necessários. Planejar `schema.sql` separado de `data.sql` (`--data-only --use-copy`). Roles somente se estritamente necessário, com aprovação, controle de privilégios e sem senhas. Não incluir schema gerenciado para contornar problema de restore.
6. Escrever em diretório privado com `umask 077`, verificando exit code, erros, tamanho, listagem sanitizada e SHA-256. Exportações incompletas ou que falhem são inválidas; **nunca** presumir que arquivo existente significa backup válido.
7. Empacotar e criptografar com mecanismo autenticado e chave/recipiente segregado (ex.: age ou OpenPGP aprovado pela segurança), guardar em destino privado com controle de acesso; registrar hash do ciphertext em manifesto confiável separado. Não publicar dump real no Git ou em artefatos públicos.
8. Baixar a cópia protegida, verificar hash, desencriptar em área temporária autorizada e restaurar em PostgreSQL isolado com dependências apropriadas. Confirmar tabelas, tipos, constraints, ownership, ACL, políticas, dados, contagens, checksums e tratamento da migration ledger.
9. Auditor recebe somente evidências **sanitizadas**: versão, origem aprovada, objetos esperados, status, timestamp, tamanhos, hashes não sensíveis, resultados e limitações, sem conteúdo empresarial, credenciais nem dados pessoais.
10. Após aceite, eliminar temporários e a chave temporária conforme política; não alegar apagamento criptográfico de SSD/backup/cloud sem evidência. Congelar a implantação remota até novo parecer.

## Critérios de bloqueio e falha

Ausência de confirmação persistida da Data API, credencial sem caminho seguro, dump que omite dependências críticas, diferença de hashes, arquivos pequenos/truncados, inconsistência de RLS/ACL ou migration ledger, restauração parcial, incompatibilidade de versão/roles, falta de criptografia/recuperação da chave ou dúvidas de escopo **bloqueiam** exportação real ou uso do resultado. Em timeout: parar, não repetir e preservar evidência; nunca fazer SQL de reparação automático.

O ensaio e as limitações mensuradas constam de `DATABASE-RESTORE-TEST.md`. Ver também `FIRST-MIGRATION-RECOVERY.md` e `RECOVERY-RUNBOOK.md`, preservados.
