# LEVIA HUB — HUB-04B1: esquema candidato de identidades

**Status:** SQL versionado e candidato para auditoria. Nenhuma migration foi aplicada ao Supabase remoto.
**Base:** HUB-04A, monólito TanStack/React e Supabase Auth futuro.

## Domínio e relações

Schema único de autorização `hub_private` **fora da lista de schemas da Data API**.
O vínculo com Supabase Auth usa somente `auth.users.id`, que é a PK administrada pela plataforma.
Não criar nem alterar estruturas dentro do schema `auth`.

- `hub_private.admin_accounts`: PK/FK `auth_user_id → auth.users.id`, `is_enabled`
  inicialmente `false`, `disabled_at`, criação, atualização e responsável opcional.
  Desabilitar requer atualização conjunta de `is_enabled`, `disabled_at` e
  `updated_at` por futuro escritor privilegiado aprovado.
- `hub_private.capabilities`: vocabulário imutável ao usuário; nove capacidades
  explícitas, identificadas por código, sem equivalência automática com papéis
  PostgreSQL. As linhas `INSERT` são apenas catálogo técnico, não autorizações.
- `hub_private.permission_grants`: UUID da concessão, FK da conta, FK da
  capacidade, escopo explícito `module` ou `resource`, início/fim de vigência,
  revogação, autor da concessão/revogação e timestamps. `valid_until` nulo é
  indeterminado, **não** concessão global. Não existe escopo `all`/`global`.
- `hub_private.permission_audit_events`: espaço append-only planejado de
  eventos, com tipo controlado, UUID da identidade afetada, identificador da
  concessão, ator e timestamp. **Sem trigger de escrita nesta etapa**: a
  completude da trilha não foi implementada e não deve ser pressuposta.

A exclusão de uma identidade Auth causa `ON DELETE CASCADE` apenas da conta e
concessões; o registro de eventos usa identificador-snapshot do beneficiário,
sem FK para ele, para evitar apagamento automático da trilha. O ator usa FK
`ON DELETE SET NULL`. Essa política de retenção deverá ser revista sob LGPD.

## Vocabulário controlado

- `core.read` — consulta administrativa delegada.
- `users.manage` — gestão futura de identidades, sujeita a aprovação distinta.
- `crm.read`, `crm.write` — leitura/escrita comercial por escopo.
- `social.read`, `social.write` — leitura e edição editorial por escopo.
- `content.review_editorial` — revisão editorial.
- `content.review_scientific` — avaliação científica.
- `content.approve_commercial` — aprovação comercial/documental.

**Não** há `content.approve` genérico e nenhuma capacidade de publicar é
concedida ou implementada. Nenhuma dessas linhas habilita funcionalidades.
Não há mapeamento automático de rótulos de perfil para permissões.

## Restrições e índices

- FK para Auth, contas e catálogo; PK em todas as quatro tabelas.
- Conta nova começa desabilitada, com consistência de status e horários.
- Concessões exigem escopo compatível com domínio (`core`, `crm`, `social`);
  chaves de recursos têm prefixo do domínio e não podem ser vazias ou globais.
- `valid_until > valid_from` quando houver término.
- Não permitir que o beneficiário figure como seu próprio concedente ou
  revogador registrado; esse `CHECK` é complemento, não substitui permissão
  de escrita restrita nem verificação da identidade do ator no backend.
- Índice `UNIQUE` parcial bloqueia duas concessões **não revogadas** com a
  mesma combinação usuário/capacidade/escopo. Renovação exige revogação
  formal anterior. Não cria expansão automática de escopos.
- Índice de auditoria por beneficiário e data atende consultas futuras.
- Ainda não há invariante atômica de auditoria (`grant` + evento); será objeto
  de design separado com funções/serviço privilegiado e revisão especial.

## Camadas de segurança

1. **Autenticação:** Supabase Auth identifica a sessão, mas não atribui papéis
   empresariais. A aplicação ainda não está conectada ao Supabase.
2. **Autorização:** futura decisão server-side/SQL deverá consultar conta
   habilitada, concessão não revogada, vigência real e escopo exato. Não usar
   e-mail, `user_metadata` editável, `authenticated` isolado ou apenas JWT
   potencialmente desatualizado.
3. **RLS + privilégios:** todas as tabelas têm RLS habilitada, **sem nenhuma
   política positiva**. `PUBLIC`, `anon`, `authenticated` e `service_role`
   recebem `REVOKE ALL` no schema e nas tabelas, além das regras padrão para
   o proprietário dos objetos. Esse controle impede acesso via papéis de
   cliente; donos, superusuários e bypass RLS ainda requerem controles
   operacionais específicos. O schema não deve ser adicionado à Data API.
4. **Aplicação:** rotas `/app/*` permanecem públicas e demonstrativas. Nenhum
   guard fictício ou cliente Supabase foi adicionado.

Os testes de concessões ativas no CI são **diagnósticos da condição proposta**,
sem função operacional de autorização. Expiração, revogação e desabilitação
**não estão conectadas a nenhuma política positiva RLS**. O primeiro acesso
real exige novo projeto de políticas por entidade, testes positivos/negativos
e autorização explícita.

## Migration, testes, reprodução e reversão

- Migration candidata: `supabase/migrations/20261024130000_identity_permissions.sql`.
  Formato oficial `YYYYMMDDHHMMSS_name.sql`. A CLI Supabase não estava
  disponível no ambiente de autoria; por isso o nome foi elaborado manualmente
  e requer verificação pelo Consultor antes de aplicação autorizada.
- Teste no repositório: `supabase/tests/identity_permissions.sql`.
- CI: `.github/workflows/identity-sql.yml` cria um contêiner Docker **PostgreSQL
  17 efêmero e sem rede**, define apenas uma tabela Auth mínima simulada,
  aplica a migration localmente, testa constraints/RLS/privileges e descarta o
  banco. Não conecta nem autentica no Supabase remoto.
- Para reproduzir isoladamente: usar PostgreSQL 17 local, criar `anon`,
  `authenticated` e `service_role` como `NOLOGIN`, schema `auth`, e tabela de
  teste `auth.users(id uuid primary key)`; executar os arquivos com
  `psql -v ON_ERROR_STOP=1 -f arquivo.sql` como administrador. Não apontar para
  banco remoto para HUB-04B1.
- Reversão futura: **não foi criada migration DOWN ou DROP**. Antes de aplicar
  remotamente, registrar dump autorizado do schema, dependências, estratégia de
  retenção e script de reversão revisado. Não realizar rollback destrutivo na
  presença de contas ou auditoria sem plano e aprovação.

Fontes: [Supabase Auth](https://supabase.com/docs/guides/auth/managing-user-data),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[SQL migrations](https://supabase.com/docs/reference/cli/global-flags),
[API security](https://supabase.com/docs/guides/api/securing-your-api).

## Decisões e pendências

Descartados: permissões em `user_metadata`, autoaprovisionamento de papéis,
concessão global implícita, funções `SECURITY DEFINER`, policies `USING (true)`,
triggers em `auth.users`, exposição de views e papéis empresariais fixos no
PostgreSQL. A escolha do catálogo pode ser refinada antes de aplicação.

Rever: semântica granular de `scope_key` quando surgirem entidades reais,
identificação confiável de quem concede, aprovação por segunda pessoa,
auditoria transacional e imutabilidade, retenção LGPD, proteção do superusuário,
bootstrap de operador autorizado, reconciliação com identidades removidas e
recuperação. Nenhum desses requisitos é considerado resolvido pelo SQL atual.

## HUB-04B1-C01 — exclusão, tempo e autoria (AT-012)

A migration permanece **não aplicada remotamente**. Os testes em PostgreSQL 17 isolado verificam estes efeitos de remoção de identidades sintéticas:

- `admin_accounts.auth_user_id`: `ON DELETE CASCADE` remove a conta quando seu usuário Auth é excluído.
- `permission_grants.subject_user_id`: o CASCADE a partir da conta apaga todas as concessões daquele beneficiário e seus detalhes de escopo, vigência, concessão e revogação.
- `granted_by_auth_user_id` e `revoked_by_auth_user_id`: `ON DELETE SET NULL` mantém concessões de terceiros, mas perde a ligação de autoria com o usuário excluído.
- `permission_audit_events.actor_auth_user_id`: `ON DELETE SET NULL` conserva eventos anteriores, mas o vínculo com o ator é perdido.
- `permission_audit_events.subject_user_id` e `grant_id`: os UUIDs históricos sem FK sobrevivem, inclusive após exclusão de contas e grants. Podem constituir dados pessoais/reidentificáveis.

**Crítico:** a migration não gera eventos de auditoria automaticamente. Os testes inserem um evento sintético manualmente apenas para demonstrar retenção. Não há trilha transacional completa e não se pode presumir que todos os grants antigos estejam representados. Definir antes do uso real a retenção, minimização, tratamento LGPD, reconciliação com identidades excluídas, autoria histórica e hipóteses de exclusão legítima. Não substituir CASCADE por RESTRICT sem decisão: isso poderia impedir exclusão regular de Auth e não resolveria a perda de evidência.

**Restrição adicionada:** `grant_revocation_not_before_grant` permite `revoked_at NULL` ou exige `revoked_at >= granted_at`. `valid_from` futuro continua permitido, inclusive revogação antes do início programado, desde que posterior à criação do grant. `valid_until > valid_from` é exigido quando há fim.

**Identidade do concedente:** `granted_by_auth_user_id IS DISTINCT FROM subject_user_id` compara somente UUIDs fornecidos. **Não autentica o ator nem impede falsificação de um terceiro UUID por escritor indevidamente autorizado.** Campos nulos suportam legado/importação controlada e SET NULL, mas não autorizam operação empresarial sem responsável validado. O futuro escritor deve ligar o ator à sessão server-side verificada, aplicar autorização, impedir campos de ator arbitrários, exigir segregação e registrar ato/evento na mesma transação. Sem isso, bloquear administração real.

**Provas locais:** 48 tentativas DML reais sob três papéis e quatro tabelas com erro SQLSTATE 42501, além de ACL individual; RLS habilitado e sem policies. Concessão temporária somente no teste, revertida, isola a negação por RLS sem confundi-la com falta de privilégio SQL. `service_role` sintético não possui BYPASSRLS como no Supabase gerenciado.
