# HUB-05 — Renovação excepcional de permissões de catálogo

## Objetivo e condições

O bootstrap inicial já instalado em `20261027212242` continua **imutável** e de uso único. A renovação usa uma nova migration aditiva e **NUNCA** cria permissões automaticamente. O responsável LEVIA deve autorizar **cada outorga, inclusive cada renovação, nominalmente**. Sem essa autorização, a segunda etapa está proibida.

A renovação existe porque a função normal de delegação HUB-04 exige que o concedente já possua a capability. Há somente um administrador, cuja expiração extinguiria essa delegação. Não se pode recorrer à autoatribuição, prolongamento implícito de prazo ou políticas RLS permissivas.

## Duas etapas independentes, não automáticas

**Etapa A — aprovação independente autenticada.** O aprovador deve ser o **mesmo operador independente registrado nos dois grants originais** de `core.read` e `users.manage` da HUB-04, com snapshots e registro de bootstrap real. Utiliza sua própria identidade Auth e sessão vigente. A nova Edge Function `hub-catalog-renew-approve` verifica a assinatura do bearer via `/auth/v1/user`, recupera a sessão Auth assinada e chama uma função SQL privada `hub_private.approve_catalog_renewal`, que confirma a sessão em `auth.sessions`, a origem independente e o histórico das duas outorgas iniciais. Isso registra uma solicitação única de 15 minutos e **um evento auditado**, sem criar ou prolongar qualquer grant.

A entrada é estritamente `action: "approve-renewal"`, `requestRef` no formato `LEVIA-HUB05R-[A-Z0-9]{12,32}`, `subject` UUID do único administrador já existente e `validUntil` timestamp UTC. A resposta não revela informações administrativas. O gateway não é método de concessão, não aceita métodos GET, não possui grants `anon/authenticated` no banco e nega JWT sem assinatura válida. Um administrador não pode aprovar a própria renovação.

**Etapa B — autorização específica do responsável + execução privada.** Um executor `postgres`, somente após confirmar a autorização do responsável LEVIA em canal privado, chama `hub_private.renew_catalog_grants` numa transação. Exige o mesmo `requestRef`, `ownerRef` novo (`LEVIA-OWNER-[A-Z0-9]{12,32}`), SHA-256 em hexadecimal minúsculo do documento de autorização, motivo de 30 a 500 caracteres, e autorização **válida apenas para aquelas duas capacidades** e prazo que a aprovação independente já propôs. O documento com a autorização não é armazenado na aplicação pública nem em Git. O hash ancora a evidência; **não equivale a verificar uma assinatura**. O executor deve comprovar a assinatura ou origem da autorização fora do banco antes de executar; não pode inventar uma referência ou manifesto de aprovação.

A função confere novamente a aprovação (exatamente uma, não vencida nem consumida), sessão Auth ainda ativa, registro imutável do bootstrap original e o único beneficiário. Recusa renovação se qualquer permissão ainda estiver vigente, se uma delas tiver sido revogada por incidente ou se o par for incompleto. **Ambas devem ter expirado naturalmente.** Só então marca os dois grants expirados como revogados com ator independente, grava dois eventos de encerramento, insere dois novos grants `module:catalog` com vencimento em no máximo 7 dias, grava dois eventos `grant_created` e um recibo imutável de consumo. Tudo na **mesma transação**, com lock. Falha de auditoria reverte integralmente.

Uma nova renovação exigirá **outro login do aprovador, outro requestRef, outra autorização do responsável, outro hash de evidência e um novo vencimento**. Nenhum cron, trigger ou procedimento renova sozinho. O recibo consumido e o índice único impedem replay. Os grants anteriores continuam no histórico.

## Verificações de segurança

- Ambas as funções SQL são `SECURITY INVOKER`, schema `hub_private`; executáveis somente pelo papel privado `postgres`. Não conceder `USAGE` ou `EXECUTE` a `anon`, `authenticated`, `service_role` ou `PUBLIC`; RLS está habilitada na nova tabela privada sem políticas positivas.
- O aprovador independente precisa fazer login real no Supabase Auth e manter uma sessão viva; o UUID fornecido pelo cliente nunca é usado como comprovação de identidade.
- O operador privado não pode falsificar a manifestação do responsável LEVIA. Ele deve verificar o documento assinado por canal independente antes da chamada de renovação; esse é o único limite de verificação fora do banco.
- A renovação rejeita aprovações com mais de 15 minutos, repetições, validade superior a sete dias, tentativas de antecipar a expiração e revogações por incidente.
- Nunca editar a migration inicial `20261027212242`, alterar `hub_private.issue_capability_grant`, habilitar privilégios públicos ou criar um segundo administrador.
- A instalação da nova migration e o deploy do endpoint não equivalem à concessão nominal inicial, aprovação independente real ou autorização da renovação.

## Ordem futura (necessita nova autorização específica para cada operação)

1. **Primeira concessão:** só executar `hub_private.bootstrap_initial_catalog_grants` após autorização nominal específica LEVIA. Ela continua pendente.
2. Fazer login com o primeiro administrador e homologar leitura, escrita, recarga, auditoria e negações em `/app/catalog` no desenvolvimento.
3. Aguardar expiração natural do primeiro par. O acesso fica negado após o prazo.
4. Registrar **nova autorização** do responsável LEVIA identificando beneficiário, capacidades, prazo, motivo e referência externa; não armazenar credenciais em PR/CI.
5. A identidade Auth independente original chama `hub-catalog-renew-approve` com requestRef único e o novo prazo. O backend verifica sua sessão e cria apenas o pedido, com validade de 15 minutos.
6. O operador confiável verifica a autorização específica independente e seu digest; executa em canal SQL privado:
   ```sql
   begin;
   select hub_private.renew_catalog_grants(
      :'request_ref'::text,
      :'owner_ref'::text,
      :'owner_evidence_sha256'::text,
      :'reason'::text
   );
   -- Conferir 2 grants antigos encerrados, 2 novos vigentes e 5 eventos
   -- (2 revogações + 2 outorgas + 1 recibo de consumo), antes do commit.
   commit;
   ```
7. Conferir ledger, origem da aprovação, eventos transacionais, RLS, prazos e Auth reais em ambiente de desenvolvimento. Testar as negações operacionais sem interromper acessos não homologados.

## Testes e artefatos

- `supabase/migrations/20261027225152_hub05_catalog_exceptional_renewal.sql`: apenas schema, funções privadas e ACLs, **não insere grants**.
- `supabase/tests/hub05_renewal.sql`: PostgreSQL 17 descartável, duas renovações sucessivas com aprovações distintas, expirado/ativo, autoatribuição, usuário incorreto, sessão falsa, digest inválido, replay, revogação por incidente, falha induzida de auditoria e rollback.
- `supabase/tests/hub05_renewal_edge.test.ts`: contratos HTTP com Auth e banco MOCK, sem rede ou segredos reais.
- `.github/workflows/hub05-full-auth-qa.yml` e `.github/workflows/hub05-edge-qa.yml`: rodadas isoladas e regressão.

**A primeira outorga nominal continua proibida até autorização expressa do responsável LEVIA; não executar renovação antes da sua expiração e de nova autorização.**
