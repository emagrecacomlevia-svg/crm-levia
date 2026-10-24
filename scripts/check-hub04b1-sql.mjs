import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261024130000_identity_permissions.sql", import.meta.url),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/identity_permissions.sql", import.meta.url),
  "utf8",
);

for (const fragment of [
  "create schema hub_private;",
  "references auth.users (id)",
  "create table hub_private.admin_accounts",
  "create table hub_private.capabilities",
  "create table hub_private.permission_grants",
  "create table hub_private.permission_audit_events",
  "permission_grant_one_unrevoked_scope",
  "grant_valid_window",
  "grant_no_self_assignment",
  "alter table hub_private.permission_grants enable row level security;",
  "revoke all on all tables in schema hub_private",
]) {
  assert.ok(migration.includes(fragment), `Missing safety invariant: ${fragment}`);
}
assert.ok(!/security\s+definer/i.test(migration.replace(/^--.*$/gm, "")), "no security definer");
assert.ok(!/create\s+policy/i.test(migration.replace(/^--.*$/gm, "")), "no permissive policies");
assert.ok(
  !/\b(create\s+table\s+(public|crm|social)|drop\s+(table|schema)|alter\s+table\s+auth\.)\b/i.test(
    migration,
  ),
  "no unexpected schema changes",
);
assert.ok(test.includes("set role anon;") && test.includes("set role authenticated;"));
assert.ok(test.includes("rollback;"), "fixtures must be rolled back");
assert.ok(!/(sb_secret_|service_role\s*=|postgresql:\/\/)/i.test(migration + test), "no secrets");
console.log("HUB-04B1 static checks passed (NOT a substitute for PostgreSQL execution).");
