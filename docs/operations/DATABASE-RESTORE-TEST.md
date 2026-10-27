# HUB-04B2B-R01 — Ensaio isolado de restauração (AT-024)

> **Estado atual (27/10/2026):** consulte o [fechamento técnico HUB-04](../delivery-reports/HUB-04-CLOSURE-20261027.md). As pendências e restrições datadas abaixo descrevem checkpoints históricos; administrador, recuperação e acesso real já foram confirmados. Os limites de produção e recuperação integral continuam explícitos no fechamento.

**Estado:** ensaio com dados exclusivamente sintéticos. Não representa exportação/restore do Supabase LEVIA. A CLI 2.122.0 é fixada; PostgreSQL 17 em contêiner descartável. Nenhum serviço Supabase gerenciado recebe conexões.

## Instrumento e evidências reprodutíveis

- Script: `scripts/qa-database-recovery-r01.sh`.
- Workflow: `.github/workflows/hub-04b2b-r01-recovery-qa.yml`, `permissions: contents: read`, checkout no PR e sem secrets remotos.
- Binário oficial via release `v2.122.0`, `checksums.txt` / `sha256sum -c`, versão conferida. O script consulta `supabase db dump --help` e descobre flags sem presumir `--dry-run` nem tentar `--skip-vault`.
- Banco: `postgres:17`, publicado somente em `127.0.0.1:55443` no runner. No PostgreSQL temporário criam-se bancos diferentes para source, restore, erro SQL, restore parcial, dependência ausente e role ausente. **Não são projetos Supabase**.
- Schema fictício `hub_recovery_lab`, contendo duas tabelas (`people`/ `events`), **dois registros sintéticos de pessoas e três eventos sintéticos**; FK, UNIQUE, CHECK, índice, RLS e política SELECT restringida a role sintética; privilégios INSERT negados.
- Exports CLI: schema filtrado por `--schema hub_recovery_lab` e dados separados com `--data-only --use-copy` usando `--db-url` fixado em `127.0.0.1`. Roles existentes no contêiner são criadas como fixture; **não** são objeto do dump.
- Integridade: arquivo de checksums para SQL, conteúdo cifrado com GPG AES256 e senha aleatória efêmera segregada no ensaio, SHA-256 do ciphertext, decifragem e comparação byte a byte antes de restaurar; nenhum artefato de dump é publicado.
- Restauração: `psql --single-transaction -v ON_ERROR_STOP=1` em banco temporário diferente, com comparação de esquema, registros, FK, índice, política, RLS, SELECT permitido/INSERT negado e fingerprints determinísticos de dados.

## Testes negativos previstos/observados no script

1. **Arquivo adulterado e arquivo truncado:** hash diferente do manifesto original. Controles rejeitam a importação antes da restauração.
2. **SQL inválido adicionado a cópia local:** psql deve falhar; assert consulta ausência do schema e prova rollback da transação.
3. **Restore incompleto:** importar somente o schema pode ter exit code zero, mas a inspeção das contagens não atende aos critérios; o ensaio rejeita o resultado.
4. **Dependência inexistente:** tentar `data.sql` em DB limpo deve falhar com objeto ausente.
5. **Role/ACL divergente:** substituir o nome da role no dump de exemplo por uma inexistente deve resultar em erro; um restore não pode silenciosamente perder grants e owners.

Estes cenários só podem ser marcados como **aprovados** após logs de workflow final `success`. O script encerra com status diferente de zero se algum controle obrigatório falhar.

## Limitações e extrapolações proibidas

- Restore local de `hub_recovery_lab` **não demonstra** recuperação de `hub_private` com FKs para `auth.users` gerenciado; não testou Auth, Storage, Vault, Data API, secrets ou serviços operacionais.
- Não restaura `supabase_migrations.schema_migrations`; o histórico deve ser inventariado e comparado independentemente, sem criação/repair manual.
- Simulação de ausência de role exige que o destino não tenha permissões padronizadas diferentes; no gerenciado ownership e default ACL podem mudar. Restauração do banco real permanece pendente.
- Hash de ciphertext depende de manifesto confiável; cifra GPG e a chave efêmera existem **só** no runner. Isto não prova custódia organizacional de chaves, compliance, backup cifrado armazenado fora do runner ou confiabilidade da recuperação real.
- Backup lógico do DB não garante PITR, RPO/RTO e recuperação gerenciada. Não é backup de objetos físicos do Storage nem de configuração da plataforma.

## Resultado rastreável

Consultar os runs do commit HEAD atual no PR Draft R01; **não** atribuir runs antigos ao HEAD novo. Os resultados de CI, limitações efetivamente observadas e falhas de implementação serão relatados em `docs/delivery-reports/HUB-04B2B-R01.md`.

Nenhum comando deve ser adaptado para `dfhjfajbmnsgrklhqtjk` sem novo parecer específico; este script é exclusivamente um teste local descartável.
