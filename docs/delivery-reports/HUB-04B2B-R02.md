# LEVIA BIOSCIENCE — HUB-04B2B-R02 — Preparação da primeira exportação real (AT-026)

**Data:** 24/10/2026. **Estado:** plano documental, **não** execução. A exportação lógica real, SQL remoto, migrations, Data API, Auth, Storage, Vault, Lovable e Cloudflare permanecem **sem autorização de escrita**. Não foi pedido ou recebido nenhum segredo.

## Checkpoint e prova somente de leitura

- Repositório: `emagrecacomlevia-svg/crm-levia`, ID `1431576812`.
- `main` de origem: `ad4340e6486a3795e00c9b116e22a286ed03b706`; árvore `2cdffd1e95a9e9e10ba6ea794c93a5dbb1dbbf9a`; PR #8 integrado.
- Candidata `supabase/migrations/20261024130000_identity_permissions.sql`, blob **inalterado** `7e954d9ce51ce0e3e96021809241a1bb9a439c59`, **não executada remotamente**.
- Supabase `levia-hub-dev`, ref `dfhjfajbmnsgrklhqtjk`, região `sa-east-1`, PostgreSQL `17.11`, `ACTIVE_HEALTHY`.
- `list_tables(public, hub_private)`: **0 tabelas**; `list_migrations`: **0 migrations**. A consulta de extensões identificou cinco instaladas: `plpgsql` 1.0, `supabase_vault` 0.3.1, `pg_stat_statements` 1.11, `pgcrypto` 1.3 e `uuid-ossp` 1.1. O inventário de tabelas não verifica todos os demais objetos SQL.
- Checkpoint Git AT-025 localizado na pasta oficial de backups, conforme a auditoria: ZIP 146 arquivos, bundle 82 commits e restauração verificada. **Não é backup de banco**.

## Matriz de decisão — controle, evidência, lacuna e deliberação

| Controle | Evidência disponível | Lacuna | Decisão requerida |
| --- | --- | --- | --- |
| Origem e integridade | Ref, região, versão, saúde, commit, tree e blob conferidos. | Estado pode mudar antes de eventual exportação. | Revalidar imediatamente antes, no AT futuro. |
| Objetos próprios exportáveis | Zero tabelas em `public`/`hub_private`; `hub_private` ainda ausente da operação. | Não foi realizado inventário autorizado de funções, views, ownership e ACL de `public`. | Autorizar inventário de catálogo **sem linhas**, delimitar se `public` contém objetos próprios. |
| Dados próprios | Zero tabelas próprias. | Ausência de tabelas não descreve dados em schemas gerenciados (intencionalmente não consultados). | Declarar `data-only` **não aplicável** enquanto não houver tabela própria; não ampliar para dados de Auth. |
| Roles / privilégios | Dependências e RLS da migration presentes no Git, R01 verificou ACL **sintética**. | Roles reais, ownership e default ACL não inventariados. | Autorizar inventário apenas de metadados, definir se role-only é necessário e como evitar credenciais/roles reservadas. |
| Migrations | Zero histórico remoto pelo conector; migration versionada no Git. | `supabase_migrations` não foi restaurado; ausência de ledger não equivale a capacidade de recuperação do serviço. | Aprovar estratégia de inventário e reconciliação, sem repair ou inserção manual. |
| Plataforma gerenciada | Cinco extensões instaladas detectadas; exclusões de dump documentadas. | Auth, Storage físico, Vault, Realtime, chaves, configurações de provedores e plano de controle não são recuperáveis integralmente pelo procedimento. | Consultor avalia risco residual da primeira migration e suficiência do escopo. |
| Data API | Captura anterior mostrou `graphql_public` e `public`, sem `hub_private`, toggle `Automatically expose new tables` desligado. | Não existe prova de persistência após **Save + reabertura**. | Responsável LEVIA fornece confirmação posterior, sem alteração por R02. |
| Máquina / credenciais | CLI 2.122.0 e `--dry-run` testados em R01 somente no loopback. | Passagem privada de segredo ao `pg_dump` Docker e ocultação de argv/logs **não homologadas**. | Designar estação e executor, aprovar cofre e testar sem dados reais um método sem segredo em parâmetros. |
| Destino / chave | R01 comprovou GPG AES256 sintético e hashes. | Não há pasta segregada, custódia, destinatários ou chave corporativa homologados. | Aprovar destino privado separado do Git, cifragem autenticada e custodiante independente. |
| Retenção / descarte | Política R01 propõe mínimos de acesso e limpeza. | Prazo, backup redundante, revogação e obrigações de conservação não aprovados. | Deliberar proposta de duas cópias protegidas e até 30 dias após aceite, com revisão obrigatória. |
| Restauração / aceite | [R01 Recovery QA #40122221132](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40122221132) = `success` para o HEAD R01 `dff5cdda944b1613a8f6b76846ff236040fde77d`. | Testou `hub_recovery_lab` fictício, não `hub_private`, `auth.users` gerenciado nem um dump real. | Exigir restore separado do escopo efetivo, paridade de dependências e autorização específica. |
| Autorização | AT-026 permite somente leitura e planejamento. | Nenhuma autorização nominal de exportação real ou migration. | Consultor audita e responsável emite AT novo e limitado à exportação; implantação requer outro AT. |

## Decisão técnica recomendada

**Não aprovar ainda a exportação real.** Antes da primeira migration, um export filtrado de `public` poderá ter pouco conteúdo útil e não restabelecer o estado gerenciado. Preservar a escolha da **Alternativa A**, mas não declarar o risco controlado somente com um arquivo SQL vazio. Solicitar nova auditoria quanto à suficiência, abrangência de objetos próprios e dependências gerenciadas.

O procedimento operacional condicional de dez passos foi registrado como **Adendo R02** em [DATABASE-BACKUP-PLAN.md](../operations/DATABASE-BACKUP-PLAN.md). Reutiliza, sem executar novamente, os testes de dump, `--dry-run`, SHA-256, GPG, restore transacional, detecção de corrupção, truncamento, rollback, restore parcial e erro de roles/dependências da R01.

A execução futura exige, **nessa ordem**: autorização específica; estação privada e ferramenta fixada; credencial entregue por cofre **fora do chat** e sem segredo em argv; inventário de metadados aprovado; Data API persistida; comando de pré-visualização privado; dump somente dos objetos próprios autorizados; criptografia e duas cópias segregadas; hashes conferidos após transferência; recuperação em PG 17 isolado; validação independente e descarte/retention auditados. Se faltar qualquer gate, **parar antes de conectar ou exportar**. O modelo de `--db-url` no plano contém placeholders não executáveis; não é liberação de credenciais nem garantia de funcionamento remoto.

O [BACKUP-ACCESS-AND-RETENTION.md](../security/BACKUP-ACCESS-AND-RETENTION.md) e o [DATABASE-RESTORE-TEST.md](../operations/DATABASE-RESTORE-TEST.md) da R01 permanecem as referências de custódia e ensaios, sem reimplementação.

## Operações e limites

**Efetivamente realizadas na R02:** GitHub por leitura; quatro consultas Supabase **de metadados somente** (`get_project`, `list_tables`, `list_migrations`, `list_extensions`); leitura de documentação oficial; documentação Git em branch exclusiva e PR Draft.

**Não realizadas:** dump, `db push`, `apply_migration`, `migration repair`, SQL remoto, criação de roles/usuários/projetos/pastas/buckets, acesso a registros pessoais, modificação de configurações, secrets no GitHub, testes com dados reais, merge e publicação.

**Referências:** https://supabase.com/docs/reference/cli/supabase-db-dump · https://supabase.com/docs/guides/platform/backups · https://www.postgresql.org/docs/17/libpq-pgpass.html

**LEVIA HUB — HUB-04B2B-R02 — Plano de Exportação Real Preparado — Aguardando Auditoria e Autorização Específica.**
