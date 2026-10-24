#!/usr/bin/env bash
# HUB-04B2B-R01 / AT-024: ONLY synthetic data and disposable PostgreSQL 17.
# This is NOT a database-export tool for any Supabase project. Never pass credentials.
set -Eeuo pipefail
umask 077
export SUPABASE_TELEMETRY_DISABLED=1
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL PGHOST PGPASSWORD || true

expected_head='8e0bf341549029813bb9ac2d49b59af28919d79e'
expected_blob='7e954d9ce51ce0e3e96021809241a1bb9a439c59'
test "$(git merge-base "$expected_head" HEAD)" = "$expected_head"
test "$(git hash-object supabase/migrations/20261024130000_identity_permissions.sql)" = "$expected_blob"
test "$(supabase --version)" = '2.122.0'
echo 'PASS: pinned Supabase CLI 2.122.0 and original candidate migration preserved'

echo '### Dump CLI flags, verified from the actual executable'
supabase db dump --help
supabase db dump --help | grep -F -- '--db-url'
supabase db dump --help | grep -F -- '--schema'
supabase db dump --help | grep -F -- '--data-only'
supabase db dump --help | grep -F -- '--role-only'
supabase db dump --help | grep -F -- '--use-copy'
supabase db dump --help | grep -F -- '--file'
if supabase db dump --help | grep -Fq -- '--dry-run'; then
  echo 'OBSERVED: dump --dry-run is listed; no assumption of push flag equivalence'
else
  echo 'OBSERVED: dump --dry-run is not supported by CLI 2.122.0'
fi

work="$(mktemp -d)"
container='levia-r01-disposable-pg17'
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
sql() {
  local db="$1"; shift
  docker exec "$container" psql -U postgres -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "$*"
}
assert_eq() {
  if test "$1" != "$2"; then
    echo "FAIL: $3 (observed '$1'; expected '$2')" >&2
    exit 1
  fi
}
db_url() {
  # Hardcoded loopback URL, NO remote host, project ref or secret.
  printf 'postgresql://postgres@127.0.0.1:55443/%s?sslmode=disable' "$1"
}
source_db='levia_r01_src'
restore_db='levia_r01_restore'
failure_db='levia_r01_failure'
partial_db='levia_r01_partial'
dependency_db='levia_r01_dependency'
ownership_db='levia_r01_ownership'

docker run --rm -d --name "$container" -p 127.0.0.1:55443:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
for i in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$container" pg_isready -U postgres >/dev/null
for db in "$source_db" "$restore_db" "$failure_db" "$partial_db" "$dependency_db" "$ownership_db"; do
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $db;" >/dev/null
done
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE ROLE r01_synthetic_reader NOLOGIN;' >/dev/null

# Source fixture: all records are synthetic, never from enterprise applications.
docker exec -i "$container" psql -U postgres -d "$source_db" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA hub_recovery_lab;
CREATE TABLE hub_recovery_lab.people (
  id integer PRIMARY KEY,
  label text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('active','inactive'))
);
CREATE TABLE hub_recovery_lab.events (
  id integer PRIMARY KEY,
  person_id integer NOT NULL REFERENCES hub_recovery_lab.people(id),
  event_type text NOT NULL CHECK (event_type IN ('created','reviewed'))
);
CREATE INDEX recovery_events_person_idx ON hub_recovery_lab.events(person_id);
INSERT INTO hub_recovery_lab.people (id, label, state) VALUES
 (1,'SYNTHETIC_PERSON_A','active'),(2,'SYNTHETIC_PERSON_B','inactive');
INSERT INTO hub_recovery_lab.events (id,person_id,event_type) VALUES
 (100,1,'created'),(101,1,'reviewed'),(102,2,'created');
ALTER TABLE hub_recovery_lab.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY r01_reader_active ON hub_recovery_lab.people
 FOR SELECT TO r01_synthetic_reader USING (state = 'active');
REVOKE ALL ON SCHEMA hub_recovery_lab FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hub_recovery_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA hub_recovery_lab TO r01_synthetic_reader;
GRANT SELECT ON hub_recovery_lab.people TO r01_synthetic_reader;
SQL
echo 'PASS: synthetic database prepared in disposable PostgreSQL 17'

mkdir -p "$work/isolated-project"
(cd "$work/isolated-project" && supabase init --yes >/dev/null)
src="$(db_url "$source_db")"
# CLI dump invokes pg_dump in a *second* Docker container. Linux host network
# makes loopback refer to the ephemeral runner, not the Docker bridge container.
# The database remains bound only to 127.0.0.1 on that runner.
(cd "$work/isolated-project" && supabase db dump --db-url "$src" \
  --schema hub_recovery_lab --network-id host --dry-run --file "$work/preview.sql") \
  > "$work/dryrun.log" 2>&1
test ! -e "$work/preview.sql"
grep -qi 'pg_dump' "$work/dryrun.log"
echo 'PASS: CLI dump --dry-run described pg_dump without creating output'
# Export schema and data deliberately separately. --role-only not needed: no custom
# role definitions are exported; target has a synthetic pre-existing role.
if ! (cd "$work/isolated-project" && supabase db dump --db-url "$src" \
  --schema hub_recovery_lab --network-id host --file "$work/schema.sql") \
  >"$work/dump-schema.log" 2>&1; then
  echo 'FAIL: isolated CLI schema export failed (sanitized diagnostic)' >&2
  sed -E 's#postgresql://[^[:space:]]+#LOCAL-URL-REDACTED#g' "$work/dump-schema.log" | tail -20 >&2
  exit 1
fi
if ! (cd "$work/isolated-project" && supabase db dump --db-url "$src" \
  --schema hub_recovery_lab --network-id host --data-only --use-copy \
  --file "$work/data.sql") >"$work/dump-data.log" 2>&1; then
  echo 'FAIL: isolated CLI data export failed (sanitized diagnostic)' >&2
  sed -E 's#postgresql://[^[:space:]]+#LOCAL-URL-REDACTED#g' "$work/dump-data.log" | tail -20 >&2
  exit 1
fi
test -s "$work/schema.sql" && test -s "$work/data.sql"
grep -Fq 'CREATE TABLE' "$work/schema.sql"
grep -Fq 'COPY hub_recovery_lab.' "$work/data.sql"
if grep -Eq '^CREATE SCHEMA (auth|storage|realtime|supabase_migrations)' "$work/schema.sql"; then
  echo 'FAIL: managed or history schema unexpectedly exported' >&2
  exit 1
fi
if grep -Fq 'SYNTHETIC_PERSON_A' "$work/schema.sql"; then
  echo 'FAIL: schema-only output included data unexpectedly' >&2
  exit 1
fi
echo 'PASS: official CLI exported separated schema and synthetic data (explicit own schema only)'

(cd "$work" && sha256sum schema.sql data.sql > payload.sha256 && sha256sum -c payload.sha256)
echo 'PASS: SHA-256 generated and verified on both plaintext files'

# Protected-envelope demonstration on synthetic data ONLY. Secret kept separate,
# created ephemerally; no key, archive or dump is uploaded as Actions artifact.
mkdir -p "$work/key-vault" "$work/protected" "$work/unsealed"
openssl rand -hex 32 > "$work/key-vault/synthetic-passphrase"
tar -cf "$work/payload.tar" -C "$work" schema.sql data.sql
gpg --quiet --batch --yes --pinentry-mode loopback --passphrase-file \
  "$work/key-vault/synthetic-passphrase" --symmetric --cipher-algo AES256 \
  --output "$work/protected/snapshot.gpg" "$work/payload.tar"
(cd "$work/protected" && sha256sum snapshot.gpg > sealed.sha256 && sha256sum -c sealed.sha256)
gpg --quiet --batch --yes --pinentry-mode loopback --passphrase-file \
  "$work/key-vault/synthetic-passphrase" --decrypt \
  --output "$work/unsealed/payload.tar" "$work/protected/snapshot.gpg"
cmp "$work/payload.tar" "$work/unsealed/payload.tar"
tar -xf "$work/unsealed/payload.tar" -C "$work/unsealed"
cmp "$work/schema.sql" "$work/unsealed/schema.sql"
cmp "$work/data.sql" "$work/unsealed/data.sql"
echo 'PASS: encrypted synthetic archive roundtrip, segregated ephemeral key and SHA-256'

# Actual restore is performed in ONE PostgreSQL transaction, never in the source DB.
cat "$work/unsealed/schema.sql" "$work/unsealed/data.sql" | \
  docker exec -i "$container" psql -U postgres -d "$restore_db" -X \
    --single-transaction -v ON_ERROR_STOP=1 >/dev/null
fingerprint() {
  sql "$1" "SELECT md5(string_agg(id::text || ':' || label || ':' || state, ',' ORDER BY id)) FROM hub_recovery_lab.people;"
}
fingerprint_events() {
  sql "$1" "SELECT md5(string_agg(id::text || ':' || person_id::text || ':' || event_type, ',' ORDER BY id)) FROM hub_recovery_lab.events;"
}
verify_restored() {
  local db="$1"
  assert_eq "$(sql "$db" "SELECT count(*) FROM information_schema.tables WHERE table_schema='hub_recovery_lab';")" '2' 'table count'
  assert_eq "$(sql "$db" "SELECT count(*) FROM hub_recovery_lab.people;")" '2' 'synthetic people'
  assert_eq "$(sql "$db" "SELECT count(*) FROM hub_recovery_lab.events;")" '3' 'synthetic events'
  assert_eq "$(sql "$db" "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='hub_recovery_lab' AND c.contype='f';")" '1' 'foreign key'
  assert_eq "$(sql "$db" "SELECT count(*) FROM pg_policies WHERE schemaname='hub_recovery_lab' AND policyname='r01_reader_active';")" '1' 'policy'
  assert_eq "$(sql "$db" "SELECT c.relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hub_recovery_lab' AND c.relname='people';")" 'true' 'RLS'
  assert_eq "$(sql "$db" "SELECT has_table_privilege('r01_synthetic_reader','hub_recovery_lab.people','SELECT')::text;")" 'true' 'read grant'
  assert_eq "$(sql "$db" "SELECT has_table_privilege('r01_synthetic_reader','hub_recovery_lab.people','INSERT')::text;")" 'false' 'write forbidden'
  assert_eq "$(sql "$db" "SELECT count(*) FROM pg_indexes WHERE schemaname='hub_recovery_lab' AND indexname='recovery_events_person_idx';")" '1' 'index'
  assert_eq "$(fingerprint "$db")" "$(fingerprint "$source_db")" 'people fingerprint'
  assert_eq "$(fingerprint_events "$db")" "$(fingerprint_events "$source_db")" 'events fingerprint'
}
verify_restored "$restore_db"
echo 'PASS: restored tables, rows, FKs, RLS, policy, index, ACL and SHA-independent fingerprints'

# Integrity-gate failure: altered file shall never be accepted for restoration.
cp "$work/data.sql" "$work/corrupt.sql"
printf '\n-- CORRUPTED FILE\n' >> "$work/corrupt.sql"
if test "$(sha256sum "$work/corrupt.sql" | cut -d' ' -f1)" = \
  "$(sha256sum "$work/data.sql" | cut -d' ' -f1)"; then
  echo 'FAIL: corrupt payload passed SHA-256 control' >&2; exit 1
fi
head -c 100 "$work/data.sql" > "$work/interrupted.sql"
if test "$(sha256sum "$work/interrupted.sql" | cut -d' ' -f1)" = \
  "$(sha256sum "$work/data.sql" | cut -d' ' -f1)"; then
  echo 'FAIL: interrupted export passed SHA-256 control' >&2; exit 1
fi
echo 'PASS: corrupted and interrupted exports rejected by trusted manifest hash'

# SQL error in a corrupted copy: atomicity must leave database empty.
cp "$work/data.sql" "$work/broken-data.sql"
printf '\nSELECT FROM;\n' >> "$work/broken-data.sql"
if (cat "$work/schema.sql" "$work/broken-data.sql" | \
    docker exec -i "$container" psql -U postgres -d "$failure_db" \
      --single-transaction -X -v ON_ERROR_STOP=1) >"$work/restore-failure.log" 2>&1; then
  echo 'FAIL: broken SQL was not rejected' >&2; exit 1
fi
assert_eq "$(sql "$failure_db" "SELECT (to_regnamespace('hub_recovery_lab') IS NULL)::text;")" 'true' 'rollback after failure'
echo 'PASS: controlled restore failure rolled back the transaction'

# Positive exit status alone does not imply full recovery: schema-only is incomplete.
docker exec -i "$container" psql -U postgres -d "$partial_db" -X \
  --single-transaction -v ON_ERROR_STOP=1 < "$work/schema.sql" >/dev/null
assert_eq "$(sql "$partial_db" "SELECT count(*) FROM hub_recovery_lab.people;")" '0' 'partial test not partial'
if test "$(sql "$partial_db" "SELECT count(*) FROM hub_recovery_lab.people;")" = '2'; then
  echo 'FAIL: incomplete restore accepted' >&2; exit 1
fi
echo 'PASS: incomplete schema-only restore detected despite SQL exit code zero'

# Data without table/schema dependencies must fail, rather than claiming recovery.
if docker exec -i "$container" psql -U postgres -d "$dependency_db" -X \
  --single-transaction -v ON_ERROR_STOP=1 < "$work/data.sql" \
  >"$work/dependency.log" 2>&1; then
  echo 'FAIL: missing dependency unexpectedly accepted' >&2; exit 1
fi
assert_eq "$(sql "$dependency_db" "SELECT (to_regnamespace('hub_recovery_lab') IS NULL)::text;")" 'true' 'dependency drift'
echo 'PASS: missing dependencies rejected on data-only restore'

# Missing target roles: demonstrate that grants/ownership depend on prior role inventory.
sed 's/r01_synthetic_reader/r01_missing_target_role/g' "$work/schema.sql" \
  > "$work/missing-role-schema.sql"
if docker exec -i "$container" psql -U postgres -d "$ownership_db" -X \
  --single-transaction -v ON_ERROR_STOP=1 < "$work/missing-role-schema.sql" \
  >"$work/ownership.log" 2>&1; then
  echo 'FAIL: missing target role unexpectedly accepted' >&2; exit 1
fi
assert_eq "$(sql "$ownership_db" "SELECT (to_regnamespace('hub_recovery_lab') IS NULL)::text;")" 'true' 'ownership/ACL rollback'
echo 'PASS: role/grant dependency mismatch safely rejected'

echo 'PASS: R01 completed using ONLY disposable PostgreSQL 17 and synthetic data.'
echo 'PASS: no real dump, no remote project, no secrets, no SQL outside Docker.'
