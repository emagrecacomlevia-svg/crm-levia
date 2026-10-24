# LEVIA HUB — HUB-04B2A: pré-implantação para auditoria

**Parecer:** AT-014. **Estado:** análise e documentação, sem aplicação
remota, sem merge, sem início de HUB-04B2B.

## Solicitado e observado

A `main` auditada estava em
`bff465997ff357bb8e79cf100bacd23ab0cb1e35`, árvore
`cc74d30bd2b12a582b0b3469c575e33129c68fa3`.
PR #4 estava integrado; migration candidata intacta, Git blob
`7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
Branch de documentação `feature/hub-04b2a-predeployment`, da base
auditada. Não houve alteração do SQL original.

Projeto de desenvolvimento: `levia-hub-dev`, Free, `sa-east-1`,
PostgreSQL 17.11, `ACTIVE_HEALTHY`. Em consultas de leitura,
`public` e `hub_private` exibem zero tabelas, migrations listadas
são zero, 38 tabelas gerenciadas foram observadas nos schemas
consultados e 78 entradas de extensões foram listadas. Advisors de
segurança e desempenho retornaram zero lints.

**Não verificado:** schemas expostos efetivos da Data API,
privilégios/heranças e `rolbypassrls` reais, ownership e default ACL.
A consulta de proteção da `main` falhou em 403 e os rulesets
retornaram vazios; a proteção da branch não está comprovada.

## Entregas preparadas

- [Análise técnica](../architecture/SUPABASE-PREFLIGHT.md):
  inventário e dependências gerenciadas, RLS/ACL, non-idempotência,
  portões para aplicação futura e checklist pós-migration.
- [Registro de riscos](../security/MIGRATION-RISK-REGISTER.md):
  riscos de schema exposto, service role, defaults, Auth, backup,
  auditoria, escopo, migração duplicada e governança.
- [Runbook de recuperação](../operations/RECOVERY-RUNBOOK.md):
  preservação de estado, erro/timeout, rollback sujeito a aprovação,
  restore isolado e não interferência nos objetos gerenciados.

## Testes efetivamente realizados

O HEAD da migration foi comparado ao SHA Git autorizado, sem editar.
As validações de DDL/constraints e 48 negativas de DML haviam sido
executadas na HUB-04B1 em PostgreSQL 17 isolado; a HUB-04B2A usa
o mesmo workflow para nova verificação na branch, se disponível.
Teste de paridade Supabase local completa NÃO realizado na autoria:
CLI Supabase e Docker não estavam disponíveis localmente.
Teste remoto de autenticação, RLS positiva ou ACL gerenciada não
existe e não deve ser declarado aprovado.

## Backup do código — estado da entrega

Backup alvo: `main` no SHA
`bff465997ff357bb8e79cf100bacd23ab0cb1e35`.
A cópia antiga HUB-04A não continha HUB-04B1. Foi reconstruído
um histórico Git contendo 47 commits e referências existentes,
com hashes Git preservados, usando o bundle prévio verificado e
os objetos públicos GitHub. Foi criado snapshot dos 126 arquivos
versionados, além de Git bundle do histórico e instruções de
recuperação; `git fsck`, `git bundle verify`, clone restaurado e
teste ZIP foram executados com sucesso.

- SHA-256 ZIP: `d18ba58634eeb1c1403f7247221d8bd5c3b900fa506d2ef956989fc748e6a6af`.
- SHA-256 bundle: `5955c4ebc07279990b40fbf7f2c203341272573e2fe6a7661741600c5f688439`.
- A tentativa inicial de upload na pasta oficial pelo serviço de
  arquivos retornou `container_session_expired`, sem arquivo remoto
  confirmado. Os arquivos locais permanecem disponíveis para entrega.
- Caso uma nova tentativa seja bem-sucedida, registrar IDs e
  conferência pós-upload no PR. Caso contrário, backup remoto fica
  **pendente**; não declarar enviado.

## Critério técnico recomendado

**BLOQUEADA para execução remota nesta etapa.** Ainda que o SQL seja
compatível conceitualmente com PostgreSQL 17 e testes isolados, não
foram verificadas configuração de Data API, ACL/default ACL reais,
o comportamento do service_role gerenciado, nem backup/restauração
do banco Free. A eventual autorização de HUB-04B2B deverá resolver
os portões, atualizar backup se `main` mudar e confirmar instrumento
de aplicação. A migration continua somente versionada.

## Operações não realizadas

Nenhum `execute_sql`, `apply_migration`, `db push`, escrita no
Supabase, alteração de usuários Auth, política RLS, Lovable, Cloudflare,
Drive de terceiros, deploy, edição de migration auditada, force-push,
rebase ou merge. Nenhuma HUB-04B2B foi iniciada.

## Encerramento pendente

Preencher no relatório final ao responsável: SHA dos commits novos,
URL de PR Draft, CI do HEAD exato e links de Drive **somente após
confirmação por leitura**. Evidências de CI não substituem a
homologação em Supabase gerenciado.
