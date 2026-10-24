# LEVIA HUB — Estratégia de ambientes Supabase

**Fase:** HUB-04A — fundação de desenvolvimento, sem integração ao frontend.  
**Natureza:** projeto público de documentação; não registrar credenciais, IDs de acesso administrativos ou dados internos.

## Estado realmente confirmado

- Ambiente lógico: **`levia-hub-dev`**, exclusivo do LEVIA HUB.
- Organização de destino escolhida expressamente pelo responsável; plano informado pela API: **Free (`tier_free`)**.
- Cotação retornada pelo Supabase para criação de um projeto nessa organização: **US$ 0 por mês**; confirmação formal de custo zero usada na operação.
- Região efetiva: **South America (São Paulo), `sa-east-1`**.
- Provisionamento consultado por leitura: **`ACTIVE_HEALTHY`**.
- Projetos visíveis na conexão: zero antes, um depois da criação; nenhum projeto pré-existente foi modificado.
- Consulta de metadados ao esquema `public`: **zero tabelas**. Tabelas internas padrão do Supabase não são funcionalidades de negócio.
- Identificadores administrativos reais e links específicos do projeto são comunicados ao responsável em relatório privado, não neste repositório público.

## Fronteiras entre ambientes

| Ambiente | Estado na HUB-04A | Dados permitidos | Finalidade |
| -------- | ----------------- | ---------------- | ---------- |
| HUB dev | Criado no plano Free, isolado | Sintéticos, quando outra fase autorizar | Evolução e testes futuros |
| HUB staging | Não criado | Nenhum | Possível homologação isolada futura |
| HUB produção | Não criado | Nenhum | Sujeito a plano, segurança e autorização separados |
| Site institucional / QR e outros sistemas | Fora do HUB | Nenhum uso compartilhado | Infraestrutura preexistente, intocada |

O projeto `levia-hub-dev` **não** está conectado à aplicação React/TanStack, ao site institucional, à Cloudflare, ao Drive ou ao Lovable Cloud. As rotas `/app/*` continuam **públicas e inteiramente demonstrativas**. Ter um serviço Auth provisionado pelo Supabase não equivale a implementar login, proteção de rotas ou RLS de negócio.

Não reutilizar este projeto como produção e não copiar dados entre sistemas. Um ambiente de produção, se aprovado, deve ter projeto, credenciais, limites, política de acesso e recuperação independentes.

## Limites e riscos do plano Free

- A documentação pública do Supabase descreve limite agregado de **até dois projetos Free** para contas elegíveis; essa capacidade é global às organizações gerenciadas pelo usuário e poderá mudar.
- O plano Free tem quotas de uso, por exemplo banco de **500 MB por projeto**, e pode **pausar projetos inativos**. Consultar as condições vigentes antes de qualquer nova operação.
- Não há backup automático gerenciado **acessível como capacidade contratada do Free**; não assumir RPO/RTO garantidos ou recuperação pela plataforma.
- Não ativar plano Pro, compute extra, PITR, domínios, add-ons ou serviços com custo. Criar um segundo projeto requer nova autorização.
- Não conectar ferramentas de CI ao banco nem armazenar chaves nas GitHub Actions nesta fase.

Fontes: [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Backups](https://supabase.com/docs/guides/platform/backups), [Regions](https://supabase.com/docs/guides/platform/regions).

## Segurança mínima para etapas futuras

1. **Negação por padrão:** não disponibilizar tabelas empresariais antes de definir permissões, `GRANT` restritos, RLS habilitada em schemas expostos e testes negativos.
2. **Privilégio mínimo:** contas técnicas não recebem necessariamente acesso irrestrito a conteúdo comercial/editorial; separar funções de infraestrutura das capacidades de negócio.
3. **Segredos:** nunca inserir `service_role`, `sb_secret_*`, tokens de gerenciamento, senha Postgres ou URL com credenciais em bundle frontend, GitHub, logs, testes ou documentação pública.
4. **Dados:** somente sintéticos em ambientes de desenvolvimento; nenhum registro clínico, de pesquisa, de cliente, preço vigente ou acervo real.
5. **Mudanças de banco:** migrations novas, versionadas, com revisão e rollback/restore planejados; não há migrations de negócio na HUB-04A.
6. **Revisão:** aceite separado para HUB-04B, incluindo especificações de [papéis](../security/ACCESS-MODEL.md), [matriz RLS](../security/RLS-TEST-PLAN.md) e recuperação.

## Recuperação e continuidade — somente planejamento

O Free não deve ser tratado como estratégia de backup confiável. Antes de qualquer persistência empresarial futura, definir, documentar e aprovar:

- exportação lógica periódica e sob credenciais de privilégio mínimo, executada fora do navegador e fora do GitHub público;
- armazenamento criptografado em local externo com acesso restrito, política de retenção e rotação de chaves;
- verificações de integridade dos arquivos, inventário de versões e restauração ensaiada em projeto **isolado e autorizado**, sem sobrescrever produção;
- responsáveis por backup/restore, trilha de execução e resposta a incidentes;
- **RPO e RTO a definir pelo responsável** e, se incompatíveis com Free, reavaliar o plano mediante autorização expressa.

**Nenhum backup, exportação, restauração, cron ou acesso a dados foi executado na HUB-04A.**

## Critérios para HUB-04B (não iniciada)

Autorizar separadamente escopo de migrations, identidade, RBAC granular, matriz de RLS com testes positivos/negativos, privacidade/LGPD, SMTP e limites de e-mail, plano de recuperação e credenciais seguras. Validar `auth.uid()` e revogação, assim como `USING` e `WITH CHECK` em UPDATE, antes de disponibilizar qualquer recurso de dados.
