# HUB-04B2A — Procedimento prospectivo de recuperação

**Não operacional:** documento sujeito a revisão. Nenhuma reversão,
`DROP`, exportação do banco, restore ou SQL foi executado remotamente.

## Estado anterior conhecido

O projeto `levia-hub-dev` permanece saudável, com zero tabelas de
negócio em `public`/`hub_private` e zero migrations listadas pelas
ferramentas de leitura. Os schemas gerenciados (`auth`, `storage`,
`realtime`) e a infraestrutura Supabase não são objeto de recuperação
automática pelo HUB.

O plano Free não oferece backup gerenciado com RPO/RTO contratados
equivalentes aos planos pagos. Sem snapshot lógico protegido e teste
de restauração compatível, o risco permanece com o responsável.

## Antes de permitir uma migration no futuro

1. Aprovar instrumento, transação DDL, janela exclusiva, responsável,
   auditor e pontos de parada.
2. Atualizar backup Git do **HEAD vigente**, conferir SHA-256 e restauração
   em diretório isolado; não confundir backup do código com backup do DB.
3. Registrar inventário de schemas, tabelas, grants, `pg_policies`,
   `pg_default_acl`, extensão, migration history e Data API.
4. Adotar exportação lógica **somente quando autorizada** e possível
   sem expor credenciais em CI, chat, git ou Drive público.
5. Guardar o artefato criptografado fora do projeto, testar integridade,
   retenção e recuperação em ambiente isolado, sem sobrescrever produção.
6. Definir RPO/RTO e responsáveis pela recuperação em caso de falha.

## Falha antes ou durante a execução futura

- **Timeout sem confirmação:** suspender novas ações; não reenviar SQL.
  Verificar posteriormente a existência da versão e dos objetos por
  metadados, a fim de distinguir falha da resposta e falha do DDL.
- **Erro de permissão/ACL:** não alterar permissões improvisadamente;
  documentar papel executor, objeto, SQLSTATE e correção proposta.
- **Execução parcial:** congelar mudanças; registrar quais objetos
  ficaram criados. Verificar se o instrumento usou transação atômica
  antes de supor rollback automático.
- **Histórico divergente:** não usar `migration repair`, `DROP SCHEMA`
  ou nova migration improvisada sem auditoria/parecer.
- **Mudança em Auth gerenciado:** interromper; não modificar as
  tabelas internas como tentativa de recuperação.

## Reversão — somente desenho, NÃO script executável

Uma revisão futura pode propor desfazer os objetos exclusivos
`hub_private` em ordem de dependências após verificar ausência de
dados empresariais e de novas dependências: auditoria, concessões,
catálogo, contas e por último schema, respeitando FKs. Isso é um
**roteiro lógico**, não autorização para `DROP` nem para apagar
históricos de migrations. A política de retenção pode proibir
exclusão de eventos e exigir exportação. Nunca remover `auth.users`,
schemas gerenciados, jobs, usuários ou projetos existentes.

A restauração deverá ser **ensaiada em banco isolado** com evidência
de esquema, regras, índices, role ACL, histórico e hashes. Só depois
de autorização independente propor qualquer ação no remoto.

## Verificação após recuperação futura

- Confirmar estado saudável e versão de migration coerente;
- comparar catálogo de objetos próprios e gerenciados pré/pós;
- verificar que `public` e `hub_private` não apresentam restos
  ou grants inesperados;
- verificar que Auth, sessões, storage e outros serviços não mudaram;
- armazenar relatório de incidentes sem segredos e comunicar auditor.

**Não executar nenhum comando deste documento nesta HUB-04B2A.**
