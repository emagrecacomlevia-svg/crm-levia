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

## Adendo R02 — preparo operacional AT-026 (24/10/2026)

**Escopo desta autorização: somente metadados, documentação e planejamento.** Esta seção complementa o plano R01; não autoriza conexão de exportação, dump real, SQL, alteração de Data API, criação de usuário/role ou implantação. A R02 **não solicitou manualmente** reexecução da R01. O workflow já existente pode ser acionado automaticamente por `pull_request.paths` quando este plano é editado; essas execuções usam apenas PostgreSQL sintético e não constituem exportação remota.

### Baseline confirmado e limites do inventário

- GitHub: repositório `emagrecacomlevia-svg/crm-levia` (ID `1431576812`), `main` `ad4340e6486a3795e00c9b116e22a286ed03b706`, árvore `2cdffd1e95a9e9e10ba6ea794c93a5dbb1dbbf9a`; PR #8 `merged=true`.
- Migration candidata **não aplicada**: `supabase/migrations/20261024130000_identity_permissions.sql` (blob `7e954d9ce51ce0e3e96021809241a1bb9a439c59`).
- Projeto lido via metadados: `levia-hub-dev` / `dfhjfajbmnsgrklhqtjk`, `sa-east-1`, PG 17.11, `ACTIVE_HEALTHY`. `list_tables` retornou zero tabelas em `public` e `hub_private`; `list_migrations` retornou zero versões remotas.
- Extensões **instaladas**, conforme `list_extensions`: `plpgsql` 1.0 (`pg_catalog`), `supabase_vault` 0.3.1 (`vault`), `pg_stat_statements` 1.11 (`extensions`), `pgcrypto` 1.3 (`extensions`), `uuid-ossp` 1.1 (`extensions`). Muitas outras aparecem apenas como disponíveis (`installed_version=null`); não contá-las como instaladas.
- Metadados de tabelas **não** inventariam por si sós funções, views, tipos, grants, default ACL, memberships de roles, cron jobs, triggers de outros schemas ou configurações gerenciadas. Não se consultaram `auth.users`, linhas de tabelas, Vault, Storage, secrets ou dados pessoais.
- Captura anterior do responsável: schemas expostos `graphql_public` e `public`, `hub_private` ausente, e opção `Automatically expose new tables` desligada **antes da prova de persistência**. Só após **Save e reabertura** do painel poderá ser aceita como configuração estável.

### Fronteira exata proposta para o primeiro backup real

| Domínio                         | Escopo futuro proposto                                                                                                                                                                                                        | Limite de cobertura                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objetos SQL próprios existentes | Primeiro realizar inventário **autorizado de metadados** de objetos não tabelares em `public`. Se forem legítimos objetos próprios, propor exportação **schema-only** filtrada para `public`.                                 | A consulta atual prova zero **tabelas**, não zero funções/views. `hub_private` ainda não existe e **não deve ser informado** como schema a exportar.                                  |
| Dados próprios                  | Atualmente zero tabelas próprias. `--data-only --use-copy` somente se novo inventário revelar tabelas/dados próprios autorizados; caso contrário, registrar **não aplicável**, sem fingir que houve proteção de dados.        | Nunca exportar por padrão `auth`, `storage`, `vault`, `realtime` ou dados de usuários.                                                                                                |
| Roles e privilégios             | Inventário de metadados autorizado de ownership, ACL, default ACL, privilégios efetivos e roles customizadas. `--role-only` **não** entra no primeiro pacote sem decisão sobre roles customizadas, exposições e dependências. | Dumps de roles não preservam necessariamente senhas; grants dependem do catálogo e dos default privileges do destino. Sem consulta de catálogo aprovada, estado é **não verificado**. |
| Histórico de migrations         | Registro de metadados: zero migrations pelo conector. Preservar separadamente as migrations versionadas do Git.                                                                                                               | Não simular `supabase_migrations.schema_migrations`, nem executar `migration repair`; dump filtrado não equivale ao histórico real.                                                   |
| Extensões e plataforma          | Inventário sanitizado de nome/schema/versão das cinco extensões instaladas. Registrar externamente configurações da Data API, Auth providers, redes e opções de serviço por evidência de painel **sem segredos**.             | Dump SQL filtrado não restaura integralmente Auth, Storage físico, Vault, Realtime, Data API, chaves, OAuth, SMTP, Edge Functions nem configuração do plano de controle.              |
| Backup Git                      | Checkpoint AT-025 verificado: ZIP com 146 arquivos e bundle de 82 commits na pasta oficial.                                                                                                                                   | Não é backup PostgreSQL.                                                                                                                                                              |

**Decisão de suficiência:** antes da primeira migration, um arquivo vazio ou schema-only de `public` não prova capacidade de reconstruir o estado gerenciado. A Alternativa A continua escolhida, mas **não satisfeita automaticamente**; o Consultor deve avaliar se o escopo recuperável responde ao risco real ou bloquear implantação. Após a migration, `hub_private` com FKs para `auth.users` exigirá outro escopo e nova autorização.

### Ordem operacional PROPOSTA após nova autorização específica — NÃO EXECUTAR

1. **Instrumento/autorização:** AT futuro identifica projeto/ref, objetivo pré-migration, versão exata do código e migration, schemas, executor nominal, janela, política de acesso, escopo de metadados e possível dump, retenção, destino privado e controle de parada. Dois aprovadores distintos: Consultor audita, responsável LEVIA autoriza. Não reutilizar AT-026 como autorização.
2. **Máquina privada:** estação gerenciada e endurecida, com Docker/pg_dump/psql PG17 e Supabase CLI **2.122.0** fixada, checksum da distribuição verificado. Versão posterior só com novo ensaio e parecer. Sem GitHub Actions, runner público, ambiente Lovable ou logs externos contendo conexão.
3. **Credencial fora do código, chat e linha de comando:** custodiante entrega direito temporário existente por cofre privado e canal aprovado. **Não** usar senha em `--password`, URI `--db-url`, histórico do shell, flags Docker, `set -x`, logs ou variáveis persistidas. PostgreSQL libpq suporta `PGPASSFILE` e arquivo com modo `0600`; **o repasse desse arquivo ao contêiner `pg_dump` da Supabase CLI 2.122.0 NÃO foi homologado**. Antes de usar a CLI no real, comprovar em laboratório privado o mecanismo ponta a ponta (montagem efêmera no contêiner, broker/proxy privado ou ferramenta alternativa expressamente auditada) e inspecionar argv, logs e processos sem expor o segredo. Se não houver mecanismo demonstrado, **PARAR**: não utilizar URL com senha como solução rápida.
4. **Inventário inicial, somente quando autorizado:** confirmar novamente projeto, saúde, versões, schemas e catálogo de objetos próprios (incluindo não tabelares), owners, ACL/default ACL, roles customizadas, dependências, extensões e ledger de migrations; registrar metadados e captura persistida da Data API, sem linhas nem senhas.
5. **Comando de pré-visualização em estação aprovada:** confirmar `supabase --version` e `supabase db dump --help`. `db dump --dry-run` imprime script `pg_dump` e foi comprovado apenas em R01 com URI local sem senha; **no real, a saída pode conter identificadores de conexão e não pode ir para logs públicos**. Não executar nem esse dry-run remoto sob AT-026.
6. **Exportação SQL condicional:** somente se houver objetos próprios exportáveis e um meio de autenticação seguro provado, usar a forma auditada `supabase db dump --db-url "<ENDPOINT_SEM_SEGREDO_APROVADO>" --schema public --file "<ARQUIVO_PRIVADO_SCHEMA_SQL>"` em estação privada. As palavras entre `<...>` são **placeholders não executáveis**; não contêm senha nem endereço remoto. Se o inventário autorizar dados próprios, uma segunda chamada separada acrescentaria `--data-only --use-copy` e o mesmo filtro de schema. **Não** incluir `--role-only` sem decisão independente, nem `hub_private` inexistente, schemas gerenciados, `--linked` ou `supabase link` automático. Se o endpoint seguro não for factível, propor instrumento alternativo e **nova homologação**, não improvisar.
7. **Controle de artefatos:** diretório temporário em volume cifrado, `umask 077`, saída e status da ferramenta verificados, ausência de falhas e tamanho plausível, inventário estrutural sanitizado, hashes SHA-256 de schema/dados. Tratamento de timeout: nenhum retry automático; marcar resultado desconhecido, isolar/quarentenar arquivo parcial, reconciliar logs locais sanitizados e metadados antes de novo parecer.
8. **Cifra/custódia:** envelope autenticado com age/OpenPGP homologado, chave independente mantida em cofre organizacional distinto do ciphertext. Calcular SHA-256 antes e depois do upload. Propor **pasta privada segregada** de dumps cifrados, não a pasta Git AT-025; não criar nem modificar agora. Verificar que recuperação da chave depende de responsável substituto e aprovação formal.
9. **Prova por restauração:** baixar ciphertext, conferir SHA-256 em manifesto confiável, descriptografar temporariamente com chave autorizada, comparar hashes SQL, restaurar somente em PostgreSQL 17 isolado, com owners/dependências pré-existentes aprovados. Testar catálogo de objetos, ACL, RLS, políticas, índices, constraints, dados próprios (se existirem) e ledger por metadados. Falha, dependência ausente, divergência de versão ou resultado parcial = **não aprovado**. Não restaurar sobre `levia-hub-dev` nem reparar history.
10. **Aceite, retenção e limpeza:** emitir relatório sem segredo. Proposta inicial **sujeita à aprovação**: uma cópia cifrada primária mais cópia cifrada independente, retenção de até **30 dias depois do aceite** ou prazo menor aprovado por Segurança/Privacidade, revisão antes de qualquer exclusão e guarda sob bloqueio contra sobrescrita. Sem prazo aprovado, exportação bloqueada. Revogar credencial temporária, limpar temporários de maneira compatível com o meio físico e registrar limitações de descarte seguro. Não excluir checkpoints Git anteriores.

O exemplo de flags descreve a sintaxe da CLI, **não uma ordem para executar agora** e nem homologação de mecanismo de credenciais. O resultado R01 comprova dump/restore apenas de `hub_recovery_lab` sintético e **não** a capacidade de exportar com segurança o projeto Supabase real.

Documentação de apoio:

- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/backups
- https://www.postgresql.org/docs/17/libpq-pgpass.html
