// Owner-only lifecycle HTTP contracts are MOCKED. No live Auth session or grants.
import assert from "node:assert/strict";
import type postgres from "npm:postgres@3.4.7";
import { hubCatalogOwnerHandler } from "../functions/hub-catalog-owner/handler.ts";
const origin = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
const owner = "d0000000-0000-4000-8000-000000000011";
const session = "e1000000-0000-4000-8000-000000000001";
const ref = "LEVIA-OWNER-QA20261028RENEW01";
const reason = "O proprietário único autoriza uma manutenção manual com auditoria e prazo curto.";
function config() {
  Deno.env.delete("LEVIA_DB_URL");
  Deno.env.set("SUPABASE_URL", origin);
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_not_secret");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", "{}");
  Deno.env.set(
    "SUPABASE_DB_URL",
    "postgresql://postgres:MOCK@db.dfhjfajbmnsgrklhqtjk.supabase.co:5432/postgres",
  );
}
function jwt() {
  const b64 = (v: unknown) =>
    btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return (
    b64({ alg: "HS256" }) +
    "." +
    b64({ session_id: session, exp: Math.floor(Date.now() / 1000) + 900 }) +
    ".SYNTHETIC"
  );
}
function expiry() {
  return new Date(Date.now() + 2 * 86400000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
const payload = () => ({ action: "renew", ownerRef: ref, reason, validUntil: expiry() });
function request(data: unknown, bearer = true, method = "POST") {
  return new Request(origin + "/functions/v1/hub-catalog-owner", {
    method,
    headers: bearer ? { authorization: "Bearer " + jwt() } : {},
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  });
}
const auth =
  (status = 200): typeof fetch =>
  async () =>
    new Response(status === 200 ? JSON.stringify({ id: owner }) : "{}", { status });
function mockDb(errorCode?: string) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const tx = {
    unsafe: async (sql: string, args: unknown[]) => {
      calls.push({ sql, args });
      if (errorCode) throw Object.assign(new Error("synthetic denial"), { code: errorCode });
      return [];
    },
  };
  const driver = {
    begin: async (f: (t: typeof tx) => Promise<unknown>) => f(tx),
    end: async () => undefined,
  };
  return { connect: (() => driver) as unknown as typeof postgres, calls };
}
Deno.test("Owner endpoint refuses anonymous and non-POST", async () => {
  config();
  const db = mockDb();
  assert.equal(
    (
      await hubCatalogOwnerHandler(request(payload(), true, "GET"), {
        fetcher: auth(),
        connect: db.connect,
      })
    ).status,
    405,
  );
  assert.equal(
    (
      await hubCatalogOwnerHandler(request(payload(), false), {
        fetcher: auth(),
        connect: db.connect,
      })
    ).status,
    401,
  );
  assert.equal(db.calls.length, 0);
});
Deno.test("Owner endpoint refuses unverifiable JWT", async () => {
  config();
  const db = mockDb();
  assert.equal(
    (await hubCatalogOwnerHandler(request(payload()), { fetcher: auth(401), connect: db.connect }))
      .status,
    401,
  );
  assert.equal(db.calls.length, 0);
});
Deno.test("Owner endpoint refuses unexpected actions, extra keys and TTL", async () => {
  config();
  const db = mockDb();
  for (const bad of [
    { ...payload(), action: "initial" },
    { ...payload(), ownerRef: "INVALID" },
    { ...payload(), validUntil: null },
    {
      ...payload(),
      validUntil: new Date(Date.now() + 8 * 86400000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    },
    { ...payload(), extra: "privilege-escalation" },
    { ...payload(), reason: "too short" },
    { ...payload(), action: "revoke" },
  ]) {
    assert.equal(
      (await hubCatalogOwnerHandler(request(bad), { fetcher: auth(), connect: db.connect })).status,
      400,
    );
  }
  assert.equal(db.calls.length, 0);
});
Deno.test("Owner renewal uses Auth-verified principal and SQL session gate", async () => {
  config();
  const db = mockDb();
  const res = await hubCatalogOwnerHandler(request(payload()), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 200);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /hub_private\.owner_catalog_change/);
  assert.deepEqual(db.calls[0].args.slice(0, 5), [owner, session, "renew", ref, reason]);
  assert.match(db.calls[0].args[6] as string, /^[0-9a-f]{64}$/);
  assert.equal(db.calls[0].args[7], "verified-auth-request");
});
Deno.test("Owner explicit revocation has no expiry and is separately audited", async () => {
  config();
  const db = mockDb();
  const res = await hubCatalogOwnerHandler(
    request({
      ...payload(),
      action: "revoke",
      ownerRef: "LEVIA-OWNER-QA20261028REVOKE01",
      validUntil: null,
    }),
    { fetcher: auth(), connect: db.connect },
  );
  assert.equal(res.status, 200);
  assert.equal(db.calls[0].args[2], "revoke");
  assert.equal(db.calls[0].args[5], null);
});
Deno.test("Owner grant SQL denial and replay remain closed", async () => {
  config();
  for (const [error, status] of [
    ["42501", 403],
    ["23505", 409],
  ] as const) {
    const db = mockDb(error);
    assert.equal(
      (await hubCatalogOwnerHandler(request(payload()), { fetcher: auth(), connect: db.connect }))
        .status,
      status,
    );
  }
});
