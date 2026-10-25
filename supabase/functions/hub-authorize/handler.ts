/**
 * HUB-04 — trusted, read-only authorization boundary.
 * Deno Supabase Edge Function; NEVER deploy with mock credentials.
 * Input: a capability/scope request. Identity: verified independently
 * against Supabase Auth, NEVER accepted from caller JSON/JWT metadata.
 * No service_role key, no database grants, no anonymous browser CORS.
 */
import postgres from "npm:postgres@3.4.7";
import { edgeConfiguration, verifiedSessionId, boundedJson } from "../_shared/configuration.ts";

const capabilities = new Set([
  "core.read",
  "users.manage",
  "crm.read",
  "crm.write",
  "social.read",
  "social.write",
  "content.review_editorial",
  "content.review_scientific",
  "content.approve_commercial",
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function hubAuthorizeHandler(
  request: Request,
  dependencies: { fetcher?: typeof fetch; connect?: typeof postgres } = {},
) {
  if (request.method !== "POST") return json(405, { allowed: false });
  if (Number(request.headers.get("content-length") ?? "0") > 2048) {
    return json(413, { allowed: false });
  }
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer)) {
    return json(401, { allowed: false });
  }
  const config = edgeConfiguration();
  if (!config) return json(503, { allowed: false });

  let body: Record<string, unknown>;
  try {
    const value: unknown = await boundedJson(request, 2048);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return json(400, { allowed: false });
    }
    body = value as Record<string, unknown>;
  } catch (error) {
    return json(error instanceof RangeError ? 413 : 400, { allowed: false });
  }
  const capability = body["capability"];
  const scopeKind = body["scopeKind"];
  const scopeKey = body["scopeKey"];
  if (
    typeof capability !== "string" ||
    !capabilities.has(capability) ||
    (scopeKind !== "module" && scopeKind !== "resource") ||
    typeof scopeKey !== "string" ||
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(scopeKey) ||
    scopeKey === "all" ||
    scopeKey === "global"
  )
    return json(400, { allowed: false });

  let verifiedId: string;
  try {
    const check = await (dependencies.fetcher ?? fetch)(config.authOrigin + "/auth/v1/user", {
      headers: { apikey: config.key, authorization: bearer },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!check.ok) return json(401, { allowed: false });
    const user: unknown = await check.json();
    if (
      !user ||
      typeof user !== "object" ||
      typeof (user as Record<string, unknown>)["id"] !== "string"
    )
      return json(401, { allowed: false });
    verifiedId = (user as { id: string }).id;
    if (!/^[0-9a-f-]{36}$/i.test(verifiedId)) return json(401, { allowed: false });
  } catch {
    return json(503, { allowed: false });
  }

  const sessionId = verifiedSessionId(bearer);
  if (!sessionId) return json(401, { allowed: false });

  // Read only; the SQL query itself binds EVERY untrusted value.
  // The database is never exposed through PostgREST / public schema.
  const sql = (dependencies.connect ?? postgres)(config.rawUrl, {
    password: config.password,
    ssl: { rejectUnauthorized: true, ...(config.ca ? { ca: config.ca } : {}) },
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 3,
  });
  try {
    const rows = await sql`
      select exists (
        select 1
        from hub_private.admin_accounts a
        inner join hub_private.permission_grants g
          on g.subject_user_id = a.auth_user_id
        inner join hub_private.capabilities c
          on c.code = g.capability_code
        where a.auth_user_id = ${verifiedId}::uuid
          and hub_private.session_is_active(${verifiedId}::uuid, ${sessionId}::uuid)
          and a.is_enabled is true
          and a.disabled_at is null
          and g.capability_code = ${capability}
          and g.scope_kind = ${scopeKind}
          and g.scope_key = ${scopeKey}
          and g.revoked_at is null
          and g.valid_from <= transaction_timestamp()
          and (g.valid_until is null or g.valid_until > transaction_timestamp())
      ) as allowed
    `;
    return json(200, { allowed: rows[0]?.allowed === true });
  } catch {
    return json(503, { allowed: false });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
