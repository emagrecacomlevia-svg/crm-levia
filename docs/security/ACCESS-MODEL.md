# LEVIA HUB — Modelo conceitual de identidade e acesso

**Fase:** HUB-04A. **Status:** proposta para revisão; nenhum papel, usuário, sessão, política, tabela ou integração foi criado.

## Objetivos

Adotar **RBAC limitado + escopos + atributos verificáveis** para evitar uma multiplicação de papéis fixos. Papéis abaixo são perfis de negócio **candidatos**, não papéis nativos de PostgreSQL nem permissões já concedidas. Uma mesma pessoa pode receber mais de uma competência **somente após aprovação formal**, com período, responsável e justificativa auditáveis.

| Perfil candidato               | Capacidades futuras típicas                                      | Restrições                                                                                          |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Administrador técnico          | Operar configurações aprovadas, suporte, segurança e diagnóstico | **Não** obter leitura comercial/editorial irrestrita automaticamente; acesso emergencial controlado |
| Gestor comercial               | Gerir escopos e trabalho comercial sob sua responsabilidade      | Não acessar outro escopo, aprovar conteúdos científicos nem administrar identidades técnicas        |
| Operador comercial             | Consultar e atualizar contatos/oportunidades designados          | Não alterar permissões, gerir aprovação, apagar históricos ou acessar outras carteiras              |
| Responsável editorial          | Propor pautas e organizar revisões dos materiais designados      | Não aprovar conclusão científica/comercial por conta própria                                        |
| Revisor científico             | Emitir parecer sobre versão e finalidade especificadas           | Não autorizar publicação ou alterar preço comercial automaticamente                                 |
| Aprovador comercial/documental | Aprovar conteúdo estritamente no escopo e versão delegados       | Não substituir revisão científica; não aprovar próprio material se segregação exigida               |
| Consulta restrita              | Consultar registros explicitamente liberados                     | Sem INSERT, UPDATE, DELETE ou exportação ampla                                                      |

Esses perfis são rótulos funcionais; permissões efetivas devem ser granularizadas por **ação, entidade, escopo, vigência e estado da conta**. Um administrador técnico pode precisar de acesso à infraestrutura sem qualquer direito de ler conteúdo empresarial.

## Fonte de verdade futura — proposta, sem implementação

- Identidade de login: Supabase Auth, identificada pela identidade validada no backend. Os dados privados de domínio **não** residem em campos de perfil editáveis pelo próprio usuário.
- Conta empresarial habilitada: registro em schema interno não exposto, com `enabled`, `revoked_at`, escopo e vinculação a `auth.users.id` (estrutura exata sujeita a design/migration na HUB-04B).
- Concessões: registros de `membership` + `permission_grant` com sujeito, capacidade, escopo/tenant, vigência, aprovador e revogação, verificados com consulta de banco no mesmo contexto de autorização.
- Auditoria: eventos imutáveis de concessão/revogação, acessados apenas por serviço backend apropriado; não criar papel SQL `service_role` personalizado.
- Não inferir permissão de `auth.role() = 'authenticated'`, nome no token, domínio de e-mail, `user_metadata`, `raw_user_meta_data` nem parâmetros fornecidos pelo frontend.
- `app_metadata` assinado pode servir como contexto auxiliar em casos aprovados, **não** como única fonte de revogação imediata, porque JWT pode permanecer válido e desatualizado; consultar o status vigente da conta e da concessão em operações críticas.
- Conta desativada ou concessão expirada: **negação imediata** por autorização no banco/backend, mesmo que um JWT ainda exista. Testar sessão em cache, revogação e `session_id` quando houver risco relevante.
- Privilégio por exceção exige dupla aprovação quando aplicável, expiração curta e registro de motivo.

## Matriz conceitual mínima por situação

| Ator / estado                     | Leitura empresarial                               | Escrita empresarial                        | Administração de acesso                            |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Sem autenticação                  | Negada                                            | Negada                                     | Negada                                             |
| Autenticado sem concessão         | Negada                                            | Negada                                     | Negada                                             |
| Operador comercial habilitado     | Só registros/escopos designados                   | Só operações e campos permitidos           | Negada                                             |
| Gestor comercial habilitado       | Só escopos delegados                              | Só comandos e escopos delegados            | Negada, salvo futura permissão específica revisada |
| Participante editorial habilitado | Apenas materiais atribuídos e versões autorizadas | Apenas etapas explicitamente delegadas     | Negada                                             |
| Administrador técnico habilitado  | Negada por padrão para conteúdo de negócio        | Negada por padrão para conteúdo de negócio | Somente controles técnicos delegados               |
| Usuário desativado ou revogado    | Negada                                            | Negada                                     | Negada                                             |

## Fluxos futuros de autenticação — não implementados

**Arquitetura-alvo:** React + TanStack Start/Router + SSR via Vite. Avaliar `@supabase/supabase-js` e `@supabase/ssr` em versões fixadas **somente na HUB-04B autorizada**, mantendo o único roteador e providers existentes. Para SSR, avaliar fluxo **PKCE**, cliente servidor por requisição e cookies de sessão com atributos `Secure`/mesmo site adequados; evitar colocar `service_role` ou segredos nas variáveis `VITE_*` e no bundle.

1. Definir se contas serão por convite e como validar endereço, MFA, dispositivos e domínio permitidos; não abrir auto-signup sem decisão.
2. Login e callback de autenticação: validar fluxo PKCE, estado anti-CSRF, cookie correto, sessão e redirect interno.
3. Rotas: aplicar checagem de identidade **no servidor**, complementada por guards TanStack para UX. Guard de UI não constitui proteção de dados.
4. Autorização: validar operação e linha **na API/backend e por RLS no banco**, inclusive acessos diretos e SSR; negar até que um papel aprovado esteja atribuído.
5. Logout: invalidar/refrescar sessão, limpar dados sensíveis em cache e testar múltiplas abas/dispositivos.
6. Recuperação de conta: token de uso único, expiração, redirect permitido, mensagens que não exponham existência de usuário, controles de abuso.
7. Sessão expirada, revogação de permissão ou usuário desativado: negar acesso a API imediatamente e redirecionar para autenticação quando pertinente.
8. E-mail: verificar limites atuais do remetente padrão no Free; avaliar SMTP autorizado e taxas de entrega **antes** de convite/recuperação. Não enviar e-mails reais nesta etapa.

**Atenção:** banco gerenciado com infraestrutura Auth nativa não significa que login ou sessão já funcionem no LEVIA HUB. As rotas `/app/*` permanecem públicas e demonstrativas na HUB-04A.

Fontes: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [Sessões](https://supabase.com/docs/guides/auth/sessions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Limites de autenticação](https://supabase.com/docs/guides/auth/rate-limits).

## HUB-04B1 — implementação candidata, ainda não operacional

Migration proposta: `supabase/migrations/20261024130000_identity_permissions.sql`.
O cadastro corporativo nasce desabilitado, sem relação automática entre
`authenticated` e capacidades empresariais. O catálogo é fechado com nove
capacidades; revisão editorial, revisão científica e aprovação comercial são
distintas. Cada concessão requer escopo nominal `module` ou `resource`, janela
válida e ausência de revogação. Escopos genéricos globais são rejeitados.

**Negação incondicional nesta fase:** schema `hub_private`, RLS habilitada sem
políticas permissivas e nenhum `GRANT` de acesso a cliente. A validação de
conta habilitada e vigência está **apenas documentada e coberta por testes
diagnósticos**; ainda não existe um caminho de autorização positivo. A trilha
`permission_audit_events` é só estrutura: eventos transacionais devem ser
implementados e auditados antes de qualquer interface de administração.

Consultar [Esquema HUB-04B1](../architecture/DATABASE-SCHEMA.md) e
[Plano de testes RLS](RLS-TEST-PLAN.md). **Não executar remotamente.**

## HUB-04B1-C01 — concessão não é identidade

`granted_by_auth_user_id <> subject_user_id` (implementado com `IS DISTINCT FROM`) é somente restrição de valores armazenados. Um escritor malicioso poderia preencher UUID de terceiro se conseguisse escrita; a desigualdade não verifica ator real. A arquitetura futura exige autenticar e vincular o ator no backend, verificar capacidade/escopo/aprovação independente e registrar grant/evento atomicamente com auditabilidade.

Ator NULL pode decorrer de migração autorizada, dados legados e `ON DELETE SET NULL`; não é concessão anônima autorizada. Fluxos normais futuros exigirão identidade de responsável validada, com exceções explícitas governadas e documentação de retenção e exclusão de dados pessoais. O SQL atual não cria esse escritor nem mecanismos de auditoria operacional.
