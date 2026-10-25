// HUB-04 MOCK: isolated Edge request tests. No database connection or remote Auth call.
import assert from "node:assert/strict";
import type postgres from "npm:postgres@3.4.7";
import { hubAuthorizeHandler } from "../functions/hub-authorize/index.ts";
import { hubAdminWriteHandler } from "../functions/hub-admin-write/index.ts";

const verifiedUser = "10000000-0000-0000-0000-000000000001";
const syntheticSubject = "10000000-0000-0000-0000-000000000002";
const grantId = "10000000-0000-0000-0000-000000000003";
const authUrl = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
const scopeRequest = { capability: "crm.read", scopeKind: "module", scopeKey: "crm" };
const authHeaders = { authorization: "Bearer mock.jwt.token", "content-type": "application/json" };

function setMockEnvironment() {
  Deno.env.set("SUPABASE_URL", authUrl);
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_test_only");
  Deno.env.set("LEVIA_DB_URL", "postgresql://postgres@db.dfhjfajbmnsgrklhqtjk.supabase.co:5432/postgres");
  Deno.env.set("LEVIA_DB_PASSWORD", "MOCK_TEST_ONLY_NON_SECRET");
  Deno.env.set("LEVIA_DB_CA_PEM", "-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----");
}
function fakeAuth(status = 200): typeof fetch {
  return async () => new Response(
    status === 200 ? JSON.stringify({ id: verifiedUser }) : "{}",
    { status, headers: { "content-type": "application/json" } },
  );
}
function fakePg(result: { allowed?: boolean; id?: string }, code?: string) {
  const queries: string[] = [];
  const tag = Object.assign(
    async (template: TemplateStringsArray, ..._values: unknown[]) => {
      queries.push(template.join("?"));
      if (code) throw Object.assign(new Error("Mock database denial"), { code });
      return [result];
    },
    { end: async () => undefined },
  );
  const connect = (() => tag) as unknown as typeof postgres;
  return { connect, queries };
}
function post(path: string, data: unknown, authenticated = true) {
  return new Request(authUrl + "/functions/v1/" + path, {
    method: "POST",
    headers: authenticated ? authHeaders : { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}
async function body(response: Response) {
  return await response.json() as Record<string, unknown>;
}

Deno.test("MOCK: authorization allows only positive database decision after Auth verify", async () => {
  setMockEnvironment();
  const db = fakePg({ allowed: true });
  const resp = await hubAuthorizeHandler(post("hub-authorize", scopeRequest), {
    fetcher: fakeAuth(), connect: db.connect,
  });
  assert.equal(resp.status, 200);
  assert.deepEqual(await body(resp), { allowed: true });
  assert.equal(db.queries.length, 1);
  assert.match(db.queries[0], /hub_private\.admin_accounts/);
});

Deno.test("MOCK: revoked, expired, disabled or scope mismatch returns denial", async () => {
  setMockEnvironment();
  for (const scenario of ["revoked", "expired", "disabled", "wrong-scope"]) {
    const db = fakePg({ allowed: false });
    const resp = await hubAuthorizeHandler(post("hub-authorize", scopeRequest), {
      fetcher: fakeAuth(), connect: db.connect,
    });
    assert.deepEqual(await body(resp), { allowed: false }, scenario);
  }
});

Deno.test("MOCK: invalid JWT and malformed scope cannot hit private database", async () => {
  setMockEnvironment();
  const db = fakePg({ allowed: true });
  const unauth = await hubAuthorizeHandler(post("hub-authorize", scopeRequest, false), {
    fetcher: fakeAuth(), connect: db.connect,
  });
  assert.equal(unauth.status, 401);
  const invalid = await hubAuthorizeHandler(post("hub-authorize", scopeRequest), {
    fetcher: fakeAuth(401), connect: db.connect,
  });
  assert.equal(invalid.status, 401);
  const malformed = await hubAuthorizeHandler(post("hub-authorize", {
    ...scopeRequest, scopeKey: "global",
  }), { fetcher: fakeAuth(), connect: db.connect });
  assert.equal(malformed.status, 400);
  assert.equal(db.queries.length, 0);
});

Deno.test("MOCK: private DB failures fail closed and return no grants", async () => {
  setMockEnvironment();
  const db = fakePg({ allowed: true }, "42501");
  const resp = await hubAuthorizeHandler(post("hub-authorize", scopeRequest), {
    fetcher: fakeAuth(), connect: db.connect,
  });
  assert.equal(resp.status, 503);
  assert.deepEqual(await body(resp), { allowed: false });
});

Deno.test("MOCK: authenticated writer dispatches only valid typed calls", async () => {
  setMockEnvironment();
  const db = fakePg({ id: grantId });
  const create = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "create-account", subject: syntheticSubject,
  }), { fetcher: fakeAuth(), connect: db.connect });
  assert.equal(create.status, 200);
  const issued = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "issue-grant", subject: syntheticSubject, capability: "crm.read",
    scopeKind: "module", scopeKey: "crm", validUntil: null,
  }), { fetcher: fakeAuth(), connect: db.connect });
  assert.equal(issued.status, 200);
  assert.equal((await body(issued))["grantId"], grantId);
  const revoked = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "revoke-grant", grantId,
  }), { fetcher: fakeAuth(), connect: db.connect });
  assert.equal(revoked.status, 200);
  assert.equal(db.queries.length, 3);
});

Deno.test("MOCK: writer blocks forged actor, self-grant escalation and DB denial", async () => {
  setMockEnvironment();
  const db = fakePg({ id: grantId });
  const unauth = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "set-enabled", subject: syntheticSubject, enabled: true,
  }), { fetcher: fakeAuth(401), connect: db.connect });
  assert.equal(unauth.status, 401);
  const forged = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "issue-grant", subject: syntheticSubject,
    capability: "admin.all", scopeKind: "module", scopeKey: "global",
  }), { fetcher: fakeAuth(), connect: db.connect });
  assert.equal(forged.status, 400);
  assert.equal(db.queries.length, 0);
  const rejected = await hubAdminWriteHandler(post("hub-admin-write", {
    action: "revoke-grant", grantId,
  }), { fetcher: fakeAuth(), connect: fakePg({}, "42501").connect });
  assert.equal(rejected.status, 403);
  assert.deepEqual(await body(rejected), { ok: false });
});

Deno.test("MOCK: missing secret causes 503; never falls back to public privileges", async () => {
  setMockEnvironment();
  Deno.env.delete("LEVIA_DB_PASSWORD");
  const db = fakePg({ allowed: true });
  const resp = await hubAuthorizeHandler(post("hub-authorize", scopeRequest), {
    fetcher: fakeAuth(), connect: db.connect,
  });
  assert.equal(resp.status, 503);
  assert.equal(db.queries.length, 0);
  setMockEnvironment();
});
