/**
 * HUB-05 owner-only manual renewal/revocation in DEV.
 * Uses verified real Supabase Auth + live session + immutable private SQL audit.
 * A request is a fresh owner decision, NEVER a scheduled/automatic renewal.
 */
import postgres from "npm:postgres@3.4.7";
import { boundedJson, edgeConfiguration, verifiedSessionId } from "../_shared/configuration.ts";

const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

function validInput(p: unknown): p is {
  action: "renew" | "revoke";
  ownerRef: string;
  reason: string;
  validUntil: string | null;
} {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const v = p as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(",") !== "action,ownerRef,reason,validUntil" ||
    !["renew", "revoke"].includes(String(v.action)) ||
    typeof v.ownerRef !== "string" ||
    !/^LEVIA-OWNER-[A-Z0-9]{12,32}$/.test(v.ownerRef) ||
    typeof v.reason !== "string" ||
    v.reason.trim().length < 30 ||
    v.reason.trim().length > 500
  )
    return false;
  if (v.action === "revoke") return v.validUntil === null;
  if (
    typeof v.validUntil !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v.validUntil)
  )
    return false;
  const expiry = Date.parse(v.validUntil);
  return (
    Number.isFinite(expiry) && expiry > Date.now() + 3600000 && expiry <= Date.now() + 7 * 86400000
  );
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function hubCatalogOwnerHandler(
  request: Request,
  dependencies: { fetcher?: typeof fetch; connect?: typeof postgres } = {},
) {
  if (request.method !== "POST") return reply(405, { ok: false });
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer)) return reply(401, { ok: false });
  const cfg = edgeConfiguration();
  if (!cfg) return reply(503, { ok: false });
  let payload: unknown;
  try {
    payload = await boundedJson(request, 2048);
  } catch (error) {
    return reply(error instanceof RangeError ? 413 : 400, { ok: false });
  }
  if (!validInput(payload)) return reply(400, { ok: false });
  let owner: string;
  try {
    const response = await (dependencies.fetcher ?? fetch)(cfg.authOrigin + "/auth/v1/user", {
      headers: { apikey: cfg.key, authorization: bearer },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return reply(401, { ok: false });
    const verified: unknown = await response.json();
    owner = (verified as { id?: unknown })?.id as string;
    if (!uuid(owner)) return reply(401, { ok: false });
  } catch {
    return reply(503, { ok: false });
  }
  const session = verifiedSessionId(bearer);
  if (!session) return reply(401, { ok: false });
  const p = payload;
  // SHA-256 anchors the exact authenticated request and live session context.
  // Not claimed as a third-party signature or approval.
  const canonical = JSON.stringify({
    owner,
    session,
    action: p.action,
    ownerRef: p.ownerRef,
    reason: p.reason.trim(),
    validUntil: p.validUntil,
  });
  const bytes = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const evidence = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sql = (dependencies.connect ?? postgres)(cfg.rawUrl, {
    password: cfg.password,
    ssl: { rejectUnauthorized: true, ...(cfg.ca ? { ca: cfg.ca } : {}) },
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 3,
  });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(
        "select hub_private.owner_catalog_change($1::uuid,$2::uuid,$3,$4,$5,$6::timestamptz,$7,$8)",
        [
          owner,
          session,
          p.action,
          p.ownerRef,
          p.reason.trim(),
          p.validUntil,
          evidence,
          "verified-auth-request",
        ],
      );
    });
    return reply(200, { ok: true, action: p.action, recorded: true });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === "42501") return reply(403, { ok: false });
    if (["23505", "23514"].includes(String(code))) return reply(409, { ok: false });
    return reply(503, { ok: false });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
