# HUB-04A — Relatório de fundação Supabase de desenvolvimento

**Autorização:** AT-009. **Estado:** projeto Free provisionado; documentação pronta para auditoria sem merge.

## Identificadores públicos e proteção de informações

- Repositório: `emagrecacomlevia-svg/crm-levia` (ID `1431576812`).
- Base da `main`: `f2e4bc21d8d63e360fcfece81533e40e057b4cda`, verificada antes da criação da branch.
- Branch exclusiva: `feature/hub-04a-supabase-foundation`.
- Identidade lógica: `levia-hub-dev`, ambiente de desenvolvimento do HUB e **não de produção**.
- A organização de destino foi escolhida expressamente em conversa; detalhes administrativos de conta e referência do projeto permanecem no relato privado ao responsável, não no GitHub público.

## Evidência de custo e criação

1. `list_organizations`: uma organização acessível; seleção expressa do responsável antes da criação.
2. `get_organization`: plano `free`, tier `tier_free`.
3. `list_projects` antes da criação: **0 projetos** visíveis na conta conectada.
4. `get_cost(type=project)`: **amount 0, recurrence monthly**, para a organização escolhida.
5. API solicitou `confirm_cost_id` inclusive para US$ 0; confirmação formal feita para **zero**, sem aprovação de cobrança positiva.
6. `create_project`: **um único projeto** chamado `levia-hub-dev`, na região `sa-east-1` (São Paulo).
7. `get_project` depois da criação: status `ACTIVE_HEALTHY`, organização, nome e região correspondentes; `list_projects` mostrou só esse projeto.
8. `list_tables` em `public`: **0 tabelas**. Não foram executados SQL, migrations, criações de usuários ou uploads.

A afirmação sobre projetos preexistentes é limitada aos recursos visíveis na conexão Supabase fornecida. Não se pode inferir a inexistência de outros projetos em contas não conectadas. A cotação de criação é US$ 0/mês no plano Free, não garantia de recursos ilimitados ou futuras condições comerciais.

## Escopo documental e riscos

- [Ambientes e recuperação](../architecture/SUPABASE-ENVIRONMENTS.md): isolamento, Free, pausa por inatividade, inexistência de recuperação contratada no Free, plano futuro de exportação/restore.
- [Papéis e Auth](../security/ACCESS-MODEL.md): perfis candidatos com atribuição controlada, cookies/PKCE/SSR, sessões e revogações **planejados, não implementados**.
- [Matriz conceitual e testes RLS](../security/RLS-TEST-PLAN.md): casos positivos/negativos `SELECT`, `INSERT`, `UPDATE`, `DELETE`, incluindo anônimo, sem papel e desativado.

As páginas `/app`, `/app/social-studio`, `/app/crm` e `/app/core` permanecem **públicas e sem autenticação**. O frontend não recebeu URL Supabase, variável de ambiente, cliente, chave ou pacote novo.

## Operações explicitamente não realizadas

Sem mudança de projetos Supabase anteriores; sem SQL, migrations, schemas próprios, tabelas, RLS, contas, login, armazenamento, buckets, Edge Functions, backup, restore, serviços pagos, integrações externas, Cloudflare, Lovable AI, Drive, publicação ou deploy. Sem trabalho da HUB-04B. PR de documentação deve permanecer Draft, sem merge.

## Verificações e auditoria

- Supabase: nome, organização, custo zero, status, região e ausência de tabelas públicas confirmados por leitura.
- GitHub: documentação versionada em branch separada, scanner básico de nomes/strings sensíveis e CI padrão, sem novos pacotes.
- Testes de RLS, Auth e recuperação: **não executados porque não existem controles de negócio nesta fase**.
- Resultados e SHA de CI/PR devem ser relatados após execução efetiva; não declarar aprovado antes do GitHub Actions.

## Decisões pendentes para nova autorização

1. Aprovar ou simplificar papéis, atribuições por escopo, segregação e tratamento de desligamento.
2. Validar nomes e entidades de negócio, alcance de consentimento, LGPD e retenção, sem usar acervo histórico como base aprovada.
3. Escolher fluxos de login/convite, MFA, SMTP e política de sessão, avaliando quotas Free.
4. Definir `RPO`/`RTO`, armazenamento externo protegido e rotina de restauração ensaiada.
5. Autorizar explicitamente migrations, implementação Auth/RLS, testes negativos e integração técnica na **HUB-04B**.

**Status:** entrega delimitada para auditoria, sem autoconcessão de aceite e sem permissão de merge.
