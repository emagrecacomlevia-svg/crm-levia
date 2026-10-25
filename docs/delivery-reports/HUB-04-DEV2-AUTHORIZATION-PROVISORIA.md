# HUB-04 / AT-040 — Integração isolada e segura do backend

**Status: PROVISÓRIO — NÃO ATIVADO NO SUPABASE REMOTO.**

A PR #11 implementa:

1. RPC servidor TanStack Start que confirma a identidade via Supabase Auth.
2. Uma função Edge de leitura `hub-authorize` que verifica novamente o JWT e consulta `hub_private` usando SQL parametrizado, sob TLS com CA e identidade do servidor verificada.
3. Gate positivo exclusivamente sob `{allowed:true}` do backend. Em caso de ausência de configuração, erro, rede, JWT inválido ou resposta irregular: acesso negado.
4. Gates adicionais `crm.read/module/crm` e `social.read/module/social`; `core.read/module/core` protege toda a seção `/app`.
5. Função Edge `hub-admin-write` para registro administrativo, alteração de estado, concessão e revogação, sempre com identidade verificada por Auth e procedimentos SQL transacionais em `hub_private`. **Não implantada**.
6. SQL em `supabase/drafts/hub04_audited_writers.sql`: funções `SECURITY INVOKER` privadas, com concessão de alcance exato, veto à própria concessão/revogação, e evento auditado na mesma transação. **Não é migration oficial**, até criação pelo Supabase CLI homologado.
7. Fixtures SQL isoladas para PostgreSQL 17 e mocks no Vitest. Nunca usam dados pessoais reais.

O requisito `LEVIA_DB_URL` é uma URL PostgreSQL sem senha, apenas do destino previamente homologado. O segredo `LEVIA_DB_PASSWORD` e a cadeia CA `LEVIA_DB_CA_PEM` são guardados exclusivamente em segredos privados do serviço. A app frontend não conhece nenhum deles.

**Porta 5432:** endpoint direto IPv6 ou session pooler apenas após homologação correspondente. Não usar transaction pooler 6543 nesta configuração. Autorização real exige conexão com `ssl verify-full` efetiva, não apenas flag nominal.

**AT-040:** a migration `20261024130000_identity_permissions.sql` permanece imutável e não aplicada remotamente. A saída read-only do conector confirmou `hub_private` ausente e ledger vazio. `apply_migration` por API não preserva comprovadamente a versão canônica do arquivo homologado; usar uma aplicação única controlada pelo CLI 2.122.0 no executor privado ou procedimento equivalente que preserve a versão, após decisão segura sobre recuperação PostgreSQL Free. Nunca executar `migration repair`.

**Avisos funcionais:**

- As rotas reais são fechadas enquanto a Edge Function não estiver homologada e o banco não contiver permissões efetivas.
- Não existe bootstrap administrativo automático. A conta inicial habilitada e as concessões somente podem ser provisionadas fora da aplicação por operação confiável auditável e autorizada.
- Sem escritor aprovado, a UI permanece somente leitura e não afirma persistir eventos.
- Conta desabilitada, permissão revogada/expirada ou escopo divergente jamais gera resposta positiva.
- Estas funções SQL requerem `postgres` (ou função equivalente privilegiada) como executor **privado**; não conceder `EXECUTE` ao `anon`, `authenticated` ou `service_role`.
- Testes PostgreSQL isolados cobrem invariantes e rollback, mas não substituem teste real das Edge Functions, certificado, rede, Auth e RLS do Supabase.
