# HUB-04B2B-E02-C02 — QA de autenticação isolada (AT-034)

**Escopo:** Somente PostgreSQL descartável. Não conectar ao Supabase LEVIA.

## Checkpoint e instrumento

- Base `main`: `d72bf14204ce8068673093998f18a22652a87e01`.
- Migration: `20261024130000_identity_permissions.sql` (sem alterações).
- Blob SQL: `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
- CLI oficial v2.122.0; pacote Linux AMD64 com checksum da release.
- SHA-256: `59ed066847b98d7461c60e9109d40cab6b9756177ce06ebb05b51338519f5136`.
- Reutiliza o workflow G01; não altera `scripts/qa-supabase-cli-g01.sh`.
- GitHub Actions `ubuntu-24.04`; permissões `contents: read`; sem secrets.

## Execução sintética

- PostgreSQL 17 descartável em Docker, publicado apenas em `127.0.0.1:55433`.
- TCP exige SCRAM-SHA-256; usuário limitado `qa_executor` sem privilégios administrativos.
- Senha sintética aleatória em `PGPASSFILE` privado, modo `0600`, fora do Git.
- URL CLI sem senha: `postgresql://qa_executor@127.0.0.1:55433/qa_auth?sslmode=disable`.
- CLI executada sob UID separado e ambiente limpo (`env -i`), sem `--linked`.
- Firewall bloqueia todo tráfego desse UID fora do loopback IPv4, inclusive IPv6.
- Proxy administrativo sintético local registra e nega tentativas HTTP(S).
- A consulta de versão em `api.github.com` pode ser tentada, mas é bloqueada.
- Qualquer outro destino HTTP(S), inclusive API Supabase, reprova o teste.
- Casos negativos: senha ausente e senha incorreta, ambos devem ser rejeitados.
- Caso positivo: autenticação da CLI via `db query` e identificação SQL da sessão.
- Prévia: `db push --db-url ... --skip-vault --dry-run`, sem executar o SQL.
- Após a prévia: `hub_private` ausente e histórico de migrations inexistente.
- Os logs temporários são verificados quanto a credenciais sintéticas e descartados.

## Limites e interrupção

Falha de autenticação, checksum, isolamento, plano ou teste de integridade reprova
este QA. A validação local não autoriza conexão ou escrita no Supabase real.

Qualquer uso remoto futuro depende de estação privada, custódia de segredos,
validação TLS com identidade do servidor (`sslmode=verify-full` e CA adequada),
revalidação do projeto, usuário SQL e privilégios, auditoria independente do
Consultor e autorização expressa do responsável LEVIA.

**Não usar TLS desabilitado fora de `127.0.0.1`. Não executar a migration.**
