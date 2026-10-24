#!/usr/bin/env bash
# HUB-04B2B-G01 / AT-021. DO NOT connect to any remotely managed Supabase.
# GitHub Actions runner, disposable PostgreSQL 17, local-only 127.0.0.1.
set -Eeuo pipefail
export SUPABASE_TELEMETRY_DISABLED=1
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL PGHOST PGPASSWORD || true

migration='supabase/migrations/20261024130000_identity_permissions.sql'
expected='7e954d9ce51ce0e3e96021809241a1bb9a439c59'
test "$(git hash-object "$migration")" = "$expected"
test "$(supabase --version)" = '2.122.0'
echo 'PASS: immutable migration blob and pinned Supabase CLI 2.122.0'

echo '### Supabase CLI evidence (no credentials)'
supabase --version
supabase --help | head -60
supabase db push --help | head -90
supabase migration list --help | head -90
supabase db push --help | grep -F -- '--dry-run'
# AT-022: explicitly prohibit automatic Vault synchronization in ALL push scenarios.
supabase db push --help | grep -F -- '--skip-vault'
echo 'PASS: CLI 2.122.0 help exposes --skip-vault'
supabase db push --help | grep -F -- '--db-url'
supabase migration list --help | grep -F -- '--db-url'

work="$(mktemp -d)"
container='levia-g01-local-pg'
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
# No project ref, no GitHub secrets, no CLI link, and no network endpoint other than localhost.
docker run --rm -d --name "$container" \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
for i in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$container" pg_isready -U postgres >/dev/null

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE hub_migration_executor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
SQL

create_fixtures() {
  local db="$1"
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $db;" >/dev/null
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "GRANT CREATE ON DATABASE $db TO hub_migration_executor;" >/dev/null
  docker exec -i "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
SET ROLE supabase_auth_admin;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
RESET ROLE;
GRANT USAGE ON SCHEMA auth TO hub_migration_executor;
GRANT REFERENCES ON auth.users TO hub_migration_executor;
SQL
}
dburl() { printf 'postgresql://hub_migration_executor@127.0.0.1:55432/%s?sslmode=disable' "$1"; }
sql() { local db="$1"; shift; docker exec "$container" psql -U postgres -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "$*"; }
assert_eq() {
  if test "$1" != "$2"; then
    echo "FAIL: $3 (got '$1'; expected '$2')" >&2
    exit 1
  fi
}
for case_name in success failure drift; do
  create_fixtures "$case_name"
  mkdir -p "$work/$case_name"
  (cd "$work/$case_name" && supabase init --yes >/dev/null)
  mkdir -p "$work/$case_name/supabase/migrations"
  cp "$migration" "$work/$case_name/supabase/migrations/20261024130000_identity_permissions.sql"
done
# Failure fixture is a TEMPORARY altered copy, never the audited source.
printf '\n-- isolated injected failure, never in Git\nSELECT 1 / 0;\n' \
  >> "$work/failure/supabase/migrations/20261024130000_identity_permissions.sql"

# Dry-run must list the candidate without creating business schema or ledger record.
(cd "$work/success" && supabase db push --db-url "$(dburl success)" --dry-run --skip-vault --yes) \
  > "$work/dryrun.log" 2>&1
grep -F '20261024130000' "$work/dryrun.log"
assert_eq "$(sql success "SELECT (to_regnamespace('hub_private') IS NULL)::text;")" 'true' 'dry-run mutated DB'
echo 'PASS: CLI db push --dry-run listed version, schema still absent'

# Genuine CLI push against disposable PostgreSQL, including its OWN history ledger.
(cd "$work/success" && supabase db push --db-url "$(dburl success)" --skip-vault --yes) \
  > "$work/success.log" 2>&1
assert_eq "$(sql success "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000';")" '1' 'CLI migration history'
assert_eq "$(sql success "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hub_private' AND c.relkind='r';")" '4' 'private tables'
assert_eq "$(sql success 'SELECT count(*) FROM hub_private.capabilities;')" '9' 'capabilities'
assert_eq "$(sql success "SELECT count(*) FROM pg_policies WHERE schemaname='hub_private';")" '0' 'unexpected positive policies'
assert_eq "$(sql success "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hub_private' AND c.relkind='r' AND c.relrowsecurity;")" '4' 'RLS missing'
assert_eq "$(sql success "SELECT count(*) FROM pg_indexes WHERE schemaname='hub_private' AND indexname IN ('permission_grant_one_unrevoked_scope','permission_audit_by_subject_date');")" '2' 'secondary indexes'
assert_eq "$(sql success "SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='hub_private' AND k.contype='f';")" '7' 'foreign keys'
docker exec -i "$container" psql -U postgres -d success -v ON_ERROR_STOP=1 \
  < supabase/tests/managed_preflight_assertions.sql > "$work/assertions.log" 2>&1
grep -F 'PASS: schema, owner, roles, RLS' "$work/assertions.log"
(cd "$work/success" && supabase migration list --db-url "$(dburl success)") \
  > "$work/list.log" 2>&1
grep -F '20261024130000' "$work/list.log"
echo 'PASS: genuine CLI ledger version 20261024130000, 4 tables, 9 capabilities, FKs/indexes/RLS/ACL'

# Duplicate CLI push must not reapply migration or add another version.
(cd "$work/success" && supabase db push --db-url "$(dburl success)" --skip-vault --yes) \
  > "$work/duplicate.log" 2>&1
assert_eq "$(sql success "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000';")" '1' 'duplicate history'
assert_eq "$(sql success 'SELECT count(*) FROM hub_private.capabilities;')" '9' 'duplicate catalog'
echo 'PASS: second CLI push does not reapply or duplicate recorded version'

# Intentional SQL error INSIDE migration: ledger and DDL must roll back together.
if (cd "$work/failure" && supabase db push --db-url "$(dburl failure)" --skip-vault --yes) \
     > "$work/failure.log" 2>&1; then
  echo 'FAIL: injected division-by-zero unexpectedly succeeded' >&2; exit 1
fi
grep -qi 'division by zero' "$work/failure.log"
assert_eq "$(sql failure "SELECT (to_regnamespace('hub_private') IS NULL)::text;")" 'true' 'failure left schema'
assert_eq "$(sql failure "SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 0 ELSE (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000') END;")" '0' 'failed migration recorded'
echo 'PASS: controlled failure rolled back schema and version record'

# Simulated drift (schema exists without ledger) must be observable and rejected.
docker exec "$container" psql -U postgres -d drift -v ON_ERROR_STOP=1 \
  -c 'CREATE SCHEMA hub_private;' >/dev/null
if (cd "$work/drift" && supabase db push --db-url "$(dburl drift)" --skip-vault --yes) \
     > "$work/drift.log" 2>&1; then
  echo 'FAIL: partial-state drift unexpectedly accepted' >&2; exit 1
fi
assert_eq "$(sql drift "SELECT (to_regnamespace('hub_private') IS NOT NULL)::text;")" 'true' 'drift schema lost'
assert_eq "$(sql drift "SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 0 ELSE (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000') END;")" '0' 'drift incorrectly recorded'
echo 'PASS: simulated drift detected (schema present, CLI history absent)'

# Reconstruct isolated database, then reapply the SAME audited file through CLI.
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE success WITH (FORCE);' >/dev/null
create_fixtures success
(cd "$work/success" && supabase db push --db-url "$(dburl success)" --skip-vault --yes) \
  > "$work/rebuild.log" 2>&1
assert_eq "$(sql success "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000';")" '1' 'rebuild history'
assert_eq "$(sql success "SELECT count(*) FROM hub_private.capabilities;")" '9' 'rebuild catalog'
echo 'PASS: isolated database reconstructed, identical audited migration reapplied via CLI'
# No CLI db push call may omit --skip-vault: all six paths are covered above.
echo 'PASS: C01 all six CLI push scenarios used --skip-vault with --db-url localhost'
echo 'PASS: G01 isolated CLI homologation concluded. No remote Supabase was contacted.'
