#!/usr/bin/env bash
# HUB-04B2B-E02-C02 / AT-034. Disposable PostgreSQL 17; no Supabase project connection.
# This QA intentionally never runs the candidate migration, even in the disposable DB.
set -Eeuo pipefail
set +x
umask 077
export SUPABASE_TELEMETRY_DISABLED=1
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD PGPASSWORD PGHOST DATABASE_URL || true

migration='supabase/migrations/20261024130000_identity_permissions.sql'
expected_blob='7e954d9ce51ce0e3e96021809241a1bb9a439c59'
version='2.122.0'
test "$(git hash-object "$migration")" = "$expected_blob"
test "$(supabase --version)" = "$version"
help="$(supabase db push --help)"
for flag in --db-url --dry-run --skip-vault; do
  grep -Fq -- "$flag" <<< "$help" || { echo "FAIL: required CLI option absent: $flag" >&2; exit 1; }
done
echo 'PASS: pinned official CLI, immutable migration, required db push options'

work="$(mktemp -d)"
chmod 0755 "$work" # Only the qa CLI user accesses its own private child files.
container="levia-c02-pg-$$"
qa_user="leviaqa$$"
proxy_pid=''
firewall_v4=0
firewall_v6=0
cleanup() {
  set +e
  if (( firewall_v6 )); then sudo -n ip6tables -D OUTPUT -m owner --uid-owner "$qa_uid" -j REJECT >/dev/null 2>&1; fi
  if (( firewall_v4 )); then sudo -n iptables -D OUTPUT -m owner --uid-owner "$qa_uid" '!' -d 127.0.0.0/8 -j REJECT >/dev/null 2>&1; fi
  if test -n "$proxy_pid"; then kill "$proxy_pid" >/dev/null 2>&1; wait "$proxy_pid" >/dev/null 2>&1; fi
  docker rm -f "$container" >/dev/null 2>&1
  sudo -n userdel "$qa_user" >/dev/null 2>&1
  sudo -n rm -rf -- "$work"
}
trap cleanup EXIT

# No secret is a CLI argument, on disk in Git, or emitted in CI logs.
password="$(openssl rand -hex 28)"
wrong_password="$(openssl rand -hex 28)"
export POSTGRES_PASSWORD="$(openssl rand -hex 28)" # synthetic bootstrap only
export POSTGRES_INITDB_ARGS='--auth-host=scram-sha-256'
docker run --rm -d --name "$container" \
  -p 127.0.0.1:55433:5432 \
  -e POSTGRES_PASSWORD -e POSTGRES_INITDB_ARGS \
  postgres:17 >/dev/null
unset POSTGRES_PASSWORD POSTGRES_INITDB_ARGS
for i in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$container" pg_isready -U postgres >/dev/null

# Docker's local socket auth remains trust for fixture creation; *host* access is SCRAM.
docker exec -i "$container" psql -U postgres -X -q -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE qa_executor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$password';
CREATE DATABASE qa_auth OWNER postgres;
SQL
actual_hba="$(docker exec "$container" psql -U postgres -d qa_auth -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_hba_file_rules WHERE type = 'host' AND auth_method = 'scram-sha-256' AND 'all' = ANY(database);")"
test "$actual_hba" -ge 1 || { echo 'FAIL: host SCRAM authentication not configured' >&2; exit 1; }
docker exec "$container" psql -U postgres -d qa_auth -X -A -t -v ON_ERROR_STOP=1 \
  -c "SELECT CASE WHEN NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND rolcanlogin THEN 'limited' ELSE 'excessive' END FROM pg_roles WHERE rolname='qa_executor';" | grep -Fxq limited

echo 'PASS: PostgreSQL 17 host SCRAM-SHA-256 and limited synthetic login role'
sudo -n useradd --system --no-create-home --shell /usr/sbin/nologin "$qa_user"
qa_uid="$(id -u "$qa_user")"
mkdir -p "$work/home" "$work/sandbox/supabase/migrations"
printf '127.0.0.1:55433:qa_auth:qa_executor:%s\n' "$password" > "$work/pgpass-good"
printf '127.0.0.1:55433:qa_auth:qa_executor:%s\n' "$wrong_password" > "$work/pgpass-bad"
chmod 0600 "$work/pgpass-good" "$work/pgpass-bad"
cp "$migration" "$work/sandbox/supabase/migrations/20261024130000_identity_permissions.sql"
sudo -n chown -R "$qa_user:$qa_user" "$work/home" "$work/sandbox" "$work/pgpass-good" "$work/pgpass-bad"
test "$(stat -c %a "$work/pgpass-good")" = 600
url='postgresql://qa_executor@127.0.0.1:55433/qa_auth?sslmode=disable'

# An observable local-only synthetic API trap; any HTTP(S) proxy request is counted and denied.
cat > "$work/proxy.py" <<'PY'
import http.server, sys
from pathlib import Path
path = Path(sys.argv[1])
class Deny(http.server.BaseHTTPRequestHandler):
    def handle_one(self):
        with path.open('a', encoding='utf8') as out:
            out.write(self.command + '\n')
        self.send_response(502)
        self.end_headers()
    do_CONNECT = handle_one
    do_GET = handle_one
    do_POST = handle_one
    do_PUT = handle_one
    do_DELETE = handle_one
    def log_message(self, *args): pass
http.server.HTTPServer(('127.0.0.1', 55434), Deny).serve_forever()
PY
: > "$work/proxy-events.log"
python3 "$work/proxy.py" "$work/proxy-events.log" & proxy_pid=$!
for i in $(seq 1 20); do
  if curl -s --max-time 2 --noproxy '' -x http://127.0.0.1:55434 http://unreachable.invalid/proxy-check >/dev/null 2>&1; then :; fi
  if test -s "$work/proxy-events.log"; then break; fi
  sleep 1
done
test -s "$work/proxy-events.log" || { echo 'FAIL: synthetic management API trap cannot observe traffic' >&2; exit 1; }
: > "$work/proxy-events.log"

# Hard network fence for ALL CLI subprocesses: localhost only, IPv4 and IPv6.
# A process not respecting HTTP_PROXY cannot reach any external management endpoint either.
sudo -n iptables -I OUTPUT 1 -m owner --uid-owner "$qa_uid" '!' -d 127.0.0.0/8 -j REJECT
firewall_v4=1
sudo -n ip6tables -I OUTPUT 1 -m owner --uid-owner "$qa_uid" -j REJECT
firewall_v6=1
if sudo -n -u "$qa_user" -- timeout 4 bash -c 'echo >/dev/tcp/1.1.1.1/443' >/dev/null 2>&1; then
  echo 'FAIL: network isolation is not enforced' >&2; exit 1
fi

# env -i prevents inherited credentials, project tokens, and external connection settings.
qa_cli() {
  local passfile="$1"; shift
  sudo -n -u "$qa_user" -- env -i \
    PATH=/usr/local/bin:/usr/bin:/bin \
    HOME="$work/home" \
    PGPASSFILE="$passfile" \
    SUPABASE_TELEMETRY_DISABLED=1 \
    HTTP_PROXY=http://127.0.0.1:55434 \
    HTTPS_PROXY=http://127.0.0.1:55434 \
    ALL_PROXY=http://127.0.0.1:55434 \
    NO_PROXY=127.0.0.1,localhost \
    "$@"
}

# Negative cases: absent and wrong credentials MUST reject the SCRAM connection.
if (cd "$work/sandbox" && qa_cli "$work/does-not-exist" supabase db query 'select current_user' --db-url "$url") > "$work/no-pass.log" 2>&1; then
  echo 'FAIL: missing credentials accepted' >&2; exit 1
fi
if (cd "$work/sandbox" && qa_cli "$work/pgpass-bad" supabase db query 'select current_user' --db-url "$url") > "$work/bad-pass.log" 2>&1; then
  echo 'FAIL: incorrect credentials accepted' >&2; exit 1
fi
echo 'PASS: SCRAM rejects missing and incorrect protected credentials'

# Positive CLI query confirms DB user with the SAME passwordless --db-url and PGPASSFILE.
if ! (cd "$work/sandbox" && qa_cli "$work/pgpass-good" supabase db query \
  "SELECT current_user AS executor, session_user AS login_role, inet_server_port() AS server_port" \
  --db-url "$url") > "$work/identity.log" 2>&1; then
  diagnostic="$(cat "$work/identity.log")"
  diagnostic="${diagnostic//"$password"/[SYNTHETIC-PASSWORD-REDACTED]}"
  diagnostic="${diagnostic//"$wrong_password"/[SYNTHETIC-PASSWORD-REDACTED]}"
  printf 'DIAGNOSTIC (synthetic, sanitized): %s\n' "$diagnostic" >&2
  echo 'FAIL: genuine CLI db query SCRAM authentication not established' >&2
  exit 1
fi
grep -Fq qa_executor "$work/identity.log" || { echo 'FAIL: PostgreSQL query did not identify the expected executor' >&2; exit 1; }
grep -Fq 5432 "$work/identity.log" || { echo 'FAIL: PostgreSQL query destination port mismatch' >&2; exit 1; }
echo 'PASS: genuine Supabase CLI authenticated via 0600 PGPASSFILE; PostgreSQL executor qa_executor on 127.0.0.1'

# This command is a preview only; NO SQL migration apply, --linked or project-ref.
(cd "$work/sandbox" && qa_cli "$work/pgpass-good" supabase db push \
  --db-url "$url" --skip-vault --dry-run) > "$work/dry-run.log" 2>&1
grep -Fq '20261024130000_identity_permissions.sql' "$work/dry-run.log" || {
  echo 'FAIL: dry-run did not show the audited migration' >&2; exit 1;
}
test "$(grep -c -F '20261024130000_identity_permissions.sql' "$work/dry-run.log")" -eq 1 || {
  echo 'FAIL: dry-run listed migration more than once' >&2; exit 1;
}
actual_schema="$(docker exec "$container" psql -U postgres -d qa_auth -X -A -t -v ON_ERROR_STOP=1 -c "SELECT (to_regnamespace('hub_private') IS NULL)::text;")"
actual_ledger="$(docker exec "$container" psql -U postgres -d qa_auth -X -A -t -v ON_ERROR_STOP=1 -c "SELECT (to_regclass('supabase_migrations.schema_migrations') IS NULL)::text;")"
test "$actual_schema" = true && test "$actual_ledger" = true || {
  echo 'FAIL: dry-run wrote database schema or migration ledger' >&2; exit 1;
}

# Check the synthetic observable API trap as well as the non-bypassable egress fence.
test ! -s "$work/proxy-events.log" || { echo 'FAIL: attempted administrative HTTP(S) request detected' >&2; exit 1; }
for logfile in "$work"/*.log; do
  logtext="$(cat "$logfile")"
  if [[ "$logtext" == *"$password"* || "$logtext" == *"$wrong_password"* ]]; then
    echo 'FAIL: synthetic credential surfaced in a CLI log' >&2; exit 1
  fi
done
unset password wrong_password logtext

echo 'PASS: db push --db-url --skip-vault --dry-run lists only migration 20261024130000'
echo 'PASS: no hub_private schema, no Supabase migration ledger, no SQL migration applied'
echo 'PASS: synthetic management API trap observed zero requests; CLI subprocess egress restricted to localhost'
echo 'PASS: no synthetic credentials in workflow logs or committed files; temporary data cleaned by trap'
echo 'PASS: E02-C02 local-only QA complete; no LEVIA Supabase project access'