// HUB-05: entirely synthetic Auth/SQL integration contract, without network.
import assert from "node:assert/strict";
import type postgres from "npm:postgres@3.4.7";
import { hubCatalogHandler, validCatalogInput } from "../functions/hub-catalog/handler.ts";

const actor = "a0000000-0000-4000-8000-000000000001";
const session = "a1000000-0000-4000-8000-000000000001";
const subject = "a2000000-0000-4000-8000-000000000001";
const origin = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
function jwt() {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return (
    segment({ alg: "HS256", typ: "JWT" }) +
    "." +
    segment({ sub: actor, session_id: session, exp: Math.floor(Date.now() / 1000) + 1800 }) +
    ".SYNTHETIC"
  );
}
function setup() {
  Deno.env.delete("LEVIA_DB_URL");
  Deno.env.set("SUPABASE_URL", origin);
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_not_secret");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", "{}");
  Deno.env.set(
    "SUPABASE_DB_URL",
    "postgresql://postgres:MOCK@db.dfhjfajbmnsgrklhqtjk.supabase.co:5432/postgres",
  );
}
function req(payload: Record<string, unknown>, authorized = true) {
  return new Request(origin + "/functions/v1/hub-catalog", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: "Bearer " + jwt() } : {}),
    },
    body: JSON.stringify(payload),
  });
}
function auth(status = 200): typeof fetch {
  return async () =>
    new Response(status === 200 ? JSON.stringify({ id: actor }) : "{}", { status });
}
function database(allowed = true, failure: string | null = null) {
  const statements: string[] = [];
  const tx = {
    unsafe: async (statement: string, parameters: unknown[] = []) => {
      statements.push(statement + " :: " + JSON.stringify(parameters));
      if (failure && statement.includes("insert into")) {
        throw Object.assign(new Error("MOCK SQL failure"), { code: failure });
      }
      if (statement.includes("actor_has_access")) return [{ allowed }];
      if (statement.includes("insert into")) return [{ id: subject }];
      return [];
    },
  };
  const sql = {
    begin: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    end: async () => undefined,
  };
  return { connect: (() => sql) as unknown as typeof postgres, statements };
}
Deno.test("MOCK catalog denies missing bearer before database access", async () => {
  setup();
  const db = database();
  const res = await hubCatalogHandler(req({ action: "snapshot" }, false), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 401);
  assert.equal(db.statements.length, 0);
});
Deno.test("MOCK catalog rejects all invalid write actions and IDs", async () => {
  setup();
  for (const p of [
    { action: "delete-all" },
    { action: "add-price", commercialVersionId: "bad", catalogVersionId: "bad", amountMinor: 100 },
    { action: "create-item", sku: "REAL-PRODUCT" },
    {
      action: "add-price",
      commercialVersionId: subject,
      catalogVersionId: subject,
      amountMinor: 1.5,
    },
  ]) {
    assert.equal(validCatalogInput(p), false);
    const res = await hubCatalogHandler(req(p), { fetcher: auth(), connect: database().connect });
    assert.equal(res.status, 400);
  }
});
Deno.test("MOCK catalog rejects invalid JWT on Auth service", async () => {
  setup();
  const db = database();
  const res = await hubCatalogHandler(req({ action: "snapshot" }), {
    fetcher: auth(401),
    connect: db.connect,
  });
  assert.equal(res.status, 401);
  assert.equal(db.statements.length, 0);
});
Deno.test(
  "MOCK catalog fails closed if Auth or database configuration is unavailable",
  async () => {
    setup();
    Deno.env.delete("SUPABASE_DB_URL");
    const db = database();
    const res = await hubCatalogHandler(req({ action: "snapshot" }), {
      fetcher: auth(),
      connect: db.connect,
    });
    assert.equal(res.status, 503);
    assert.equal(db.statements.length, 0);
  },
);
Deno.test("MOCK catalog returns real-shaped snapshot only after exact read grant", async () => {
  setup();
  const db = database();
  const res = await hubCatalogHandler(req({ action: "snapshot" }), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 200);
  const value = await res.json();
  assert.equal(value.ok, true);
  assert.deepEqual(value.items, []);
  assert.equal(
    db.statements.some((s) => s.includes("catalog.read")),
    true,
  );
  assert.equal(
    db.statements.some((s) => s.includes("insert into")),
    false,
  );
});
Deno.test("MOCK catalog denies read and write without specific grant", async () => {
  setup();
  const db = database(false);
  const res = await hubCatalogHandler(req({ action: "create-item", sku: "DEMO-ALFA" }), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { ok: false });
  assert.equal(
    db.statements.some((s) => s.includes("insert into")),
    false,
  );
});
Deno.test("MOCK catalog writes within one verified session transaction", async () => {
  setup();
  const db = database();
  const res = await hubCatalogHandler(req({ action: "create-item", sku: "DEMO-ALFA" }), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: subject });
  assert.equal(
    db.statements.some((s) => s.includes("catalog.write")),
    true,
  );
  assert.equal(
    db.statements.some((s) => s.includes("levia.hub05_actor")),
    true,
  );
  assert.equal(
    db.statements.some((s) => s.includes("levia.hub05_session")),
    true,
  );
  assert.equal(
    db.statements.some((s) => s.includes("insert into hub_catalog_private.catalog_items")),
    true,
  );
});
Deno.test("MOCK SQL failure never confirms a write, preserves error classification", async () => {
  setup();
  const db = database(true, "23505");
  const res = await hubCatalogHandler(req({ action: "create-item", sku: "DEMO-ALFA" }), {
    fetcher: auth(),
    connect: db.connect,
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).ok, false);
});
