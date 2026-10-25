/**
 * HUB-04 PROVISORIA — privileged, audited writer boundary.
 * Deploy only after the original schema and CLI-generated writer migration.
 * Each database function atomically changes state and writes the audit event.
 * No CORS for browsers, no logging JWTs, no service_role key in frontend.
 */
import postgres from "npm:postgres@3.4.7";
import { edgeConfiguration, verifiedSessionId, boundedJson } from "../_shared/configuration.ts";

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
function uuid(input: unknown): input is string {
  return (
    typeof input === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)
  );
}

export async function hubAdminWriteHandler(
  request: Request,
  dependencies: { fetcher?: typeof fetch; connect?: typeof postgres } = {},
) {
  if (request.method !== "POST") return response(405, { ok: false });
  if (Number(request.headers.get("content-length") ?? "0") > 4096) {
    return response(413, { ok: false });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) {
    return response(401, { ok: false });
  }
  const cfg = edgeConfiguration();
  if (!cfg) return response(503, { ok: false });

  let actor: string;
  try {
    const identity = await (dependencies.fetcher ?? fetch)(cfg.authOrigin + "/auth/v1/user", {
      headers: { authorization, apikey: cfg.key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!identity.ok) return response(401, { ok: false });
    const verified: unknown = await identity.json();
    actor = (verified as { id?: unknown })?.id as string;
    if (!uuid(actor)) return response(401, { ok: false });
  } catch {
    return response(503, { ok: false });
  }

  let payload: Record<string, unknown>;
  try {
    const data: unknown = await boundedJson(request, 4096);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return response(400, { ok: false });
    }
    payload = data as Record<string, unknown>;
  } catch (error) {
    return response(error instanceof RangeError ? 413 : 400, { ok: false });
  }

  const action = payload["action"];
  const subject = payload["subject"];
  const grantId = payload["grantId"];
  const capability = payload["capability"];
  const scopeKind = payload["scopeKind"];
  const scopeKey = payload["scopeKey"];
  const enabled = payload["enabled"];
  const validUntil = payload["validUntil"];

  const validScope =
    typeof scopeKey === "string" &&
    /^[a-z][a-z0-9:_-]{0,127}$/.test(scopeKey) &&
    !["all", "global"].includes(scopeKey);
  const validGrant =
    typeof capability === "string" &&
    [
      "core.read",
      "users.manage",
      "crm.read",
      "crm.write",
      "social.read",
      "social.write",
      "content.review_editorial",
      "content.review_scientific",
      "content.approve_commercial",
    ].includes(capability) &&
    (scopeKind === "module" || scopeKind === "resource") &&
    validScope &&
    (validUntil === null ||
      validUntil === undefined ||
      (typeof validUntil === "string" &&
        Number.isFinite(Date.parse(validUntil)) &&
        validUntil.length <= 40));

  if (
    (action === "create-account" && !uuid(subject)) ||
    (action === "set-enabled" && (!uuid(subject) || typeof enabled !== "boolean")) ||
    (action === "issue-grant" && (!uuid(subject) || !validGrant)) ||
    (action === "revoke-grant" && !uuid(grantId)) ||
    !["create-account", "set-enabled", "issue-grant", "revoke-grant"].includes(action as string)
  )
    return response(400, { ok: false });

  const sessionId = verifiedSessionId(authorization);
  if (!sessionId) return response(401, { ok: false });

  const sql = (dependencies.connect ?? postgres)(cfg.rawUrl, {
    password: cfg.password,
    ssl: { rejectUnauthorized: true, ...(cfg.ca ? { ca: cfg.ca } : {}) },
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 3,
  });
  try {
    const rows = await sql`select hub_private.session_bound_write(
      ${actor}::uuid, ${sessionId}::uuid, ${action as string}, ${sql.json(payload as postgres.JSONValue)}::jsonb
    ) as result`;
    return response(200, { ok: true, ...(rows[0]?.result ?? {}) });
  } catch (error) {
    // Never disclose SQL exceptions, identities, or token information.
    const code = (error as { code?: unknown })?.code;
    if (code === "42501") return response(403, { ok: false });
    if (code === "23505" || code === "23503" || code === "23514" || code === "P0002") {
      return response(409, { ok: false });
    }
    return response(503, { ok: false });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
