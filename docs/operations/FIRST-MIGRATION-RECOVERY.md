# HUB-04B2A-C01 — Recuperação proposta para a primeira migration

**Planejamento exclusivamente. Nenhum rollback, dump ou DDL remoto executado.**

## Situação e pressupostos

A infraestrutura gerenciada de Auth, Storage e Realtime já existe; o HUB
não possui tabelas próprias nem migrations registradas. O SQL candidato
cria um schema privado, quatro tabelas, nove códigos estáticos e índices.
O backup **Git** da `main` auditada está verificado e recuperável no Drive,
mas não há backup lógico nem ensaio de restauração de **banco** confirmado.
O Supabase Free não oferece o mesmo regime de backups gerenciados dos
planos Pro. Não presumir recuperação pontual (PITR).

## Portões anteriores a qualquer aplicação futura

1. Verificar a identidade exata do projeto e ausência de objetos próprios.
2. Obter evidência de Data API, catálogo de privilégios e role executor.
3. Confirmar SHA da migration, repositório e revisão do Consultor.
4. Confirmar procedimento com ferramenta fixada, janela exclusiva,
   transação, dry-run e histórico de migrations, com teste isolado.
5. Estabelecer baseline de metadados de Auth/Storage sem dados reais.
6. Definir backup lógico protegido e ensaio de restauração quando
   autorizado, ou aceitação explícita da impossibilidade no Free.
7. Registrar quem decide parada, recuperação e conclusão.

## Matriz de incidentes — ação permitida somente após nova autorização

**1. Operação recusada antes de iniciar:** interromper. Não tentar
elevar permissões. Manter schema ausente e migration não registrada;
corrigir plano e solicitar novo parecer.

**2. Erro dentro da transação:** se o instrumento confirmou transação
única, verificar por leitura a ausência de objetos e do registro;
reexecutar somente após parecer. No PostgreSQL 17 isolado a simulação
com erro intencional confirmou rollback, mas **não prova** a atomicidade
do futuro caminho CLI gerenciado.

**3. Timeout sem confirmação:** nenhum retry automático. Capturar
identificador de execução e comparar versão de migration, schema,
tabelas, privilégios e horário em consultas autorizadas. Tratar como
estado **desconhecido** até reconciliar.

**4. Objetos existem e migration não consta no histórico:** declarar
drift/bloqueio. Preservar evidências. Não executar
`migration repair`, `DROP` ou inserir marcador à mão sem
deliberação de reparação separada.

**5. Privilégios inesperados:** suspender qualquer integração/conta.
Verificar grants efetivos, `PUBLIC`, ownership, defaults, schema
exposto e `service_role`. Não conceder permissões de conveniência
nem reconfigurar a Data API de forma improvisada.

**6. Alteração em objetos gerenciados:** incidente crítico. Não
modificar `auth.users`, Storage ou Realtime; preservar logs,
congelar alterações e acionar suporte e responsáveis. Uma reversão
automática de schema privado não garante recuperação gerenciada.

## RPO e RTO — propostas, NÃO aprovadas

- **Cenário autorizado somente com objetos vazios:** RPO candidato
  de **0 registros empresariais** (não existem dados de negócio);
  essa métrica não garante recuperar metadados ou estado operacional.
- **Tempo de decisão e diagnóstico:** RTO candidato de até **um dia
  útil** para identificar estado e restaurar capacidade de prosseguir,
  **sem SLA** e sujeito a teste/aceite. Pode exceder esse prazo sem
  backup/restauração de banco comprovados.
- Antes de qualquer usuário ou dado empresarial real, definir RPO/RTO
  próprios com backup lógico criptografado, guarda segregada e ensaio
  isolado; opção de permanecer sem implantação se recuperação for
  insuficiente.

## Recuperação sem sobrescrever produção

Preservar o backup Git atual e arquivos anteriores, registrar
checksums e novos backups por evento. Qualquer restauração futura
deve ocorrer primeiro em banco isolado sem dados reais, comprovando
schema, constraints, ACL, owners e migration history. O roteiro
não inclui `DROP` ou SQL executável; rollback de objetos
gerenciados não está autorizado.

Ver também [RECOVERY-RUNBOOK](RECOVERY-RUNBOOK.md), cuja versão
histórica permanece intacta.
