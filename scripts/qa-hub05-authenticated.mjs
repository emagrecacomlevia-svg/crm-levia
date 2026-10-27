/**
 * HUB-05 positive real QA. NEVER call before the nominal catalog grants
 * have been expressly authorized, audited and independently provisioned.
 * Uses Auth verified against live Supabase and creates ONE synthetic item.
 * No password, JWT, identity UUID or API key is printed.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
const approved = process.env["LEVIA_HUB05_EXPLICIT_APPROVAL"] === "SIM";
const reference = process.env["LEVIA_HUB05_APPROVAL_REF"] ?? "";
const token = process.env["LEVIA_HUB05_AUTH_BEARER"] ?? "";
const key = process.env["LEVIA_HUB05_PUBLISHABLE_KEY"] ?? "";
const declaredOrigin = process.env["LEVIA_HUB05_SUPABASE_ORIGIN"] ?? "";

if (
  !approved ||
  !/^LEVIA-HUB05-[A-Z0-9]{12,32}$/.test(reference) ||
  declaredOrigin !== origin ||
  !token ||
  !key
) {
  console.error(
    "BLOQUEADO: requer autorização nominal registrada, sessão Auth válida e destino dev.",
  );
  process.exitCode = 2;
} else {
  const headers = {
    apikey: key,
    authorization: "Bearer " + token,
    "content-type": "application/json",
  };
  async function catalog(body, overrideHeaders = headers) {
    const response = await fetch(origin + "/functions/v1/hub-catalog", {
      method: "POST",
      headers: overrideHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    const authResponse = await fetch(origin + "/auth/v1/user", {
      headers: { apikey: key, authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    assert.equal(authResponse.status, 200, "Auth did not verify the user");
    const identity = await authResponse.json();
    assert.match(identity.id, /^[0-9a-f-]{36}$/i);

    const tokenClaims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    assert.match(tokenClaims.session_id, /^[0-9a-f-]{36}$/i);

    // Real HTTP deny-by-default before the first authorized read/write.
    const anonymous = await catalog({ action: "snapshot" }, { apikey: key });
    assert.equal(anonymous.status, 401, "Anonymous read unexpectedly succeeded");
    const invalid = await catalog(
      { action: "snapshot" },
      { apikey: key, authorization: "Bearer deliberately.invalid.jwt" },
    );
    assert.equal(invalid.status, 401, "Invalid Auth bearer unexpectedly succeeded");

    const before = await catalog({ action: "snapshot" });
    assert.equal(before.status, 200, "catalog.read grant not operational");
    assert.equal(before.data.ok, true);
    assert.ok(Array.isArray(before.data.items));

    const sku = "DEMO-HUB05-QA-" + randomBytes(6).toString("hex").toUpperCase();
    const write = await catalog({ action: "create-item", sku });
    assert.equal(write.status, 200, "catalog.write grant not operational");
    assert.equal(write.data.ok, true);
    assert.match(write.data.id, /^[0-9a-f-]{36}$/i);

    const after = await catalog({ action: "snapshot" });
    assert.equal(after.status, 200, "Read after persisted write failed");
    assert.ok(
      after.data.items.some((item) => item.id === write.data.id && item.sku === sku),
      "Persisted item not found after fresh read",
    );
    assert.ok(
      after.data.audit.some(
        (event) =>
          event.entity === "catalog_items" &&
          event.objectId === write.data.id &&
          event.actor === identity.id &&
          event.sessionId === tokenClaims.session_id,
      ),
      "No transactional audit row bound to verified Auth actor and session",
    );

    console.log(
      "PASS: real Auth, catalog.read, catalog.write, reload, audit and anonymous denial.",
    );
    console.log("QA item created in development (synthetic only); no secrets printed.");
  } catch (error) {
    console.error(
      "FAIL: positive operational QA — " +
        (error instanceof Error ? error.message : "Unknown failure"),
    );
    process.exitCode = 1;
  }
}
