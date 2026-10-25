# HUB-04 — Desenvolvimento isolado (AT-040)

**Estado:** implementação parcial, branch separada, sem aplicação remota da migration.

## Entrega neste ciclo

- Política de capabilities em TypeScript com avaliação estrita de concessões, escopos, vigência, revogação e conta desabilitada. **Não** usar objetos enviados pelo cliente como fonte de verdade.
- Autenticação com Supabase Auth via API GoTrue **servidor**, sem service_role no frontend ou no servidor; sessão cifrada e HttpOnly pelo utilitário TanStack Start, refresh de sessão, verificação de identidade no servidor, logout com tentativa de revogação remota.
- Rotas internas protegidas com bloqueio total enquanto não houver verificador positivo confiável para `hub_private`. A tela de acesso negado documenta a restrição; nenhum usuário autenticado vira administrador por padrão.
- Testes unitários isolados das regras de negação; nenhum teste real de banco ou autenticação foi executado por esta implementação.

## Controles

- Variáveis de servidor necessárias: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY`) e `LEVIA_SESSION_SECRET` com no mínimo 32 caracteres. Nunca prefixar com `VITE_`.
- Todos os server functions que retornam decisão de autorização executam verificação no servidor. A proteção visual do router não substitui autorização de dados.
- Cookies `HttpOnly`, `SameSite=Lax`, `Secure` em ambiente não-dev e prefixo `__Host-` em HTTPS. Prazo máximo da sessão de sete dias, com refresh de token e validação de identidade.
- Cadastro público, concessão administrativa, escritor de auditoria, consultas diretas a `hub_private`, publicação e implantação permanecem **desabilitados**.

## Bloqueios remanescentes

1. **Crítico:** migration `20261024130000_identity_permissions.sql` continua não aplicada por bloqueio AT-040. Preservar o blob `7e954d9ce51ce0e3e96021809241a1bb9a439c59`. Nenhum repair/reset/reapply.
2. **Crítico:** contrato backend auditado para consulta de `admin_accounts`/`permission_grants` sem expor o schema e escrita transacional auditada ainda não aprovado. Rotas /app negam todos até existir essa autorização.
3. **Alto:** testes end-to-end com contas sintéticas e banco isolado, Auth real, RLS direto, revogação de concessões e logout em múltiplos dispositivos não realizados.
4. **Alto:** configuração segura de implantação de variáveis privadas, RPO/RTO e recuperação PostgreSQL Free ainda sem homologação.
5. **Médio:** rate limiting próprio e política de convite/MFA/recuperação aguardam definições de governança.

## Não constitui

Não representa HUB-04 em produção ou completamente aprovada. Não cria identidades, privilégios, políticas permissivas, buckets, schema ou concessões reais.

CI: corrigida restrição de importação cliente/servidor ao mover as declarações createServerFn para módulo isomórfico fora de /server/; implementações privadas permanecem em arquivos .server.ts.
