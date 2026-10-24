# HUB-04B2B-E02-C02 — Isolated `--db-url` authentication QA (AT-034)

**Scope:** Proposed test only. The protected `levia-hub-dev` project (`dfhjfajbmnsgrklhqtjk`) must never be a GitHub Actions connection target. Do not interpret this test as acceptance of actual LEVIA database credentials or authorization to deploy.

## Pinned inputs and existing QA

- Immutable main baseline: `d72bf14204ce8068673093998f18a22652a87e01`.
- Candidate: `supabase/migrations/20261024130000_identity_permissions.sql`; Git blob `7e954d9ce51ce0e3e96021809241a1bb9a439c59` (never edited).
- Supabase CLI **v2.122.0**, official GitHub Linux AMD64 release `supabase_2.122.0_linux_amd64.tar.gz`, SHA-256 `59ed066847b98d7461c60e9109d40cab6b9756177ce06ebb05b51338519f5136`; compare with the official `checksums.txt` and the pinned digest.
- Keep `scripts/qa-supabase-cli-g01.sh` unchanged. This separate test is executed by `.github/workflows/hub-04b2b-g01-cli-qa.yml` only after original isolated QA.
- Runner: GitHub-hosted `ubuntu-24.04`, `permissions: contents: read`, `SUPABASE_TELEMETRY_DISABLED=1`; no GitHub secrets, real tokens, project links, or remote database URLs.

## Isolation and test design

`bash scripts/qa-supabase-cli-e02-c02-dburl-auth.sh` creates a disposable `postgres:17` Docker container bound **only to host `127.0.0.1:55433`**. PostgreSQL enforces **SCRAM-SHA-256 on TCP host connections** and authenticates a synthetic, non-superuser, non-`CREATEROLE`, non-`CREATEDB` role `qa_executor`. Synthetic passwords are random and exist only in process memory or temporary private files outside Git, never in CLI arguments.

A private `PGPASSFILE` (`0600`) contains a matching synthetic entry. The CLI receives an intentionally passwordless URL: `postgresql://qa_executor@127.0.0.1:55433/qa_auth?sslmode=disable` and `PGPASSFILE`, **never** `--password`, `--linked` or `--project-ref`. All CLI commands run as a separate Linux UID under `env -i`, with an empty HOME and only required variables. Firewall rules prohibit that UID's outbound IPv4/IPv6 traffic except IPv4 loopback. A local synthetic HTTP(S) proxy trap is tested first and must observe no requests during the CLI tests. These controls detect and prevent remote administrative calls even if proxy settings were bypassed. Firewall, container, temp files, user and proxy are removed on shell exit.

The test exercises: CLI help and exact version; rejection of missing credentials; rejection of incorrect `PGPASSFILE`; genuine CLI `db query` SCRAM authentication with correct `PGPASSFILE`; identity `current_user`/`session_user` from the test PostgreSQL; genuine CLI `db push --db-url ... --dry-run --skip-vault`. After the preview, independent catalog reads must confirm **no `hub_private` schema**, **no `supabase_migrations.schema_migrations`** and thus no recorded migration. Only the audited migration may appear in the preview. The positive and negative CLI logs are scanned for both synthetic password values before being discarded. No logs or secrets are uploaded as artifacts.

## Stop conditions and interpretation

Any CLI SHA/version mismatch, password not recognized, unsuccessful authentication, inability to enforce outbound isolation, attempted HTTP(S) request, unexpected dry-run plan, database catalog mutation or secret leakage **fails the job**. In particular, a green result is **local-only homologation** for this exact CLI version/OS/configuration. It is **not** proof of TLS trust, public network reachability or Postgres privileges in LEVIA Supabase.

For any later, separately authorized private workstation test, use a **separate private secret store** (no chat/GitHub logs), verify the exact database host and its project ownership, require proper TLS with certificate validation (`sslmode=verify-full`, applicable CA), validate `session_user` and `current_user` against the intended executor, assert grants including `REFERENCES` on `auth.users`, and avoid exposing plaintext secrets in process arguments or shell history. A direct remote connection must **never** use `sslmode=disable`. Do not run `db push` or any remote write without independent Consultant approval and explicit owner authorization.

**No migration application, Git merge, Auth change, Storage change or LEVIA Supabase access is part of AT-034.**