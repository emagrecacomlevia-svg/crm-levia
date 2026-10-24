#!/usr/bin/env bash
# AT-016: PostgreSQL 17-only isolated approximation; no Supabase connection.
set -euo pipefail
container=levia-hub04b2a-c01-pg
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container")" = "none"
for i in $(seq 1 45); do
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
CREATE DATABASE managed_success;
CREATE DATABASE managed_failure;
SQL
for db in managed_success managed_failure; do
  docker exec -i "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
SET ROLE supabase_auth_admin;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
RESET ROLE;
GRANT USAGE ON SCHEMA auth TO hub_migration_executor;
GRANT REFERENCES ON auth.users TO hub_migration_executor;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY);
GRANT USAGE ON SCHEMA supabase_migrations TO hub_migration_executor;
GRANT INSERT, SELECT ON supabase_migrations.schema_migrations TO hub_migration_executor;
SQL
done
docker cp supabase/migrations/20261024130000_identity_permissions.sql \
  "$container":/tmp/identity_permissions.sql
docker cp supabase/tests/managed_preflight_assertions.sql \
  "$container":/tmp/managed_preflight_assertions.sql

# Inject an intentional error AFTER the candidate within a single transaction.
# The DDL and synthetic history marker must roll back together.
if docker exec "$container" psql -U hub_migration_executor -d managed_failure \
  -X -v ON_ERROR_STOP=1 --single-transaction \
  -f /tmp/identity_permissions.sql \
  -c "INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20261024130000')" \
  -c "SELECT 1 / 0" > /tmp/levia-controlled-failure.log 2>&1; then
  echo "FAIL: controlled failure unexpectedly succeeded"; exit 1
fi
grep -q "division by zero" /tmp/levia-controlled-failure.log
failure_state=$(docker exec "$container" psql -U postgres -d managed_failure -At \
  -c "SELECT (to_regnamespace('hub_private') IS NULL)::text || ':' || (SELECT count(*) FROM supabase_migrations.schema_migrations)::text")
test "$failure_state" = "true:0"
echo "PASS: atomic rollback on controlled failure (schema absent, history empty)"

# Success case: transactional candidate plus a synthetic migration-history row.
# This is NOT the Supabase CLI migration ledger or a managed Supabase deployment.
docker exec "$container" psql -U hub_migration_executor -d managed_success \
  -X -v ON_ERROR_STOP=1 --single-transaction \
  -f /tmp/identity_permissions.sql \
  -c "INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20261024130000')" \
  > /tmp/levia-managed-success.log
docker exec "$container" psql -U postgres -d managed_success -X -v ON_ERROR_STOP=1 \
  -f /tmp/managed_preflight_assertions.sql

# Explicit DML denials: never treat zero affected rows as a denial.
denied=0
for role in anon authenticated service_role; do
  for table in admin_accounts capabilities permission_grants permission_audit_events; do
    case "$table" in
      admin_accounts) column=auth_user_id ;;
      capabilities) column=code ;;
      permission_grants|permission_audit_events) column=id ;;
    esac
    for operation in SELECT INSERT UPDATE DELETE; do
      case "$operation" in
        SELECT) statement="SELECT * FROM hub_private.$table LIMIT 1" ;;
        INSERT) statement="INSERT INTO hub_private.$table DEFAULT VALUES" ;;
        UPDATE) statement="UPDATE hub_private.$table SET $column = $column WHERE false" ;;
        DELETE) statement="DELETE FROM hub_private.$table WHERE false" ;;
      esac
      if docker exec "$container" psql -U postgres -d managed_success \
          -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
          -c "SET ROLE $role; $statement" > /tmp/levia-managed-denial.log 2>&1; then
        echo "FAIL: accepted $role $operation on $table"; exit 1
      fi
      if ! grep -q '42501:' /tmp/levia-managed-denial.log; then
        echo "FAIL: unexpected SQLSTATE for $role $operation $table"
        cat /tmp/levia-managed-denial.log
        exit 1
      fi
      denied=$((denied + 1))
    done
  done
done
test "$denied" -eq 48
echo "PASS: $denied/48 explicit DML attempts denied with SQLSTATE 42501"
echo "PASS: --network none, real BYPASSRLS service_role approximation"
