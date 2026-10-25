/**
 * HUB-04 PROVISORIA — privileged, audited writer boundary.
 * Deploy only after the original schema and CLI-generated writer migration.
 * Each database function atomically changes state and writes the audit event.
 * No CORS for browsers, no logging JWTs, no service_role key in frontend.
 */
import postgres from "npm:postgres@3.4.7";

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

function configuration() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const dbUrl = Deno.env.get("LEVIA_DB_URL");
  const password = Deno.env.get("LEVIA_DB_PASSWORD");
  const ca = Deno.env.get("LEVIA_DB_CA_PEM");
  if (!url || !key || !dbUrl || !password || !ca) return null;
  try {
    const parsed = new URL(dbUrl);
    if (
      url !== "https://dfhjfajbmnsgrklhqtjk.supabase.co" ||
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/postgres" ||
      (parsed.port && parsed.port !== "5432") ||
      !(
        parsed.hostname === "db.dfhjfajbmnsgrklhqtjk.supabase.co" ||
        parsed.hostname === "aws-1-sa-east-1.pooler.supabase.com"
      ) ||
      !ca.includes("BEGIN CERTIFICATE")
    )
      return null;
    return { url, key, dbUrl, password, ca };
  } catch {
    return null;
  }
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
  const cfg = configuration();
  if (!cfg) return response(503, { ok: false });

  let actor: string;
  try {
    const identity = await (dependencies.fetcher ?? fetch)(cfg.url + "/auth/v1/user", {
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
    const data: unknown = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return response(400, { ok: false });
    }
    payload = data as Record<string, unknown>;
  } catch {
    return response(400, { ok: false });
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

  const sql = (dependencies.connect ?? postgres)(cfg.dbUrl, {
    password: cfg.password,
    ssl: { rejectUnauthorized: true, ca: cfg.ca },
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 3,
  });
  try {
    if (action === "create-account") {
      await sql`select hub_private.create_admin_account(${actor}::uuid,${subject as string}::uuid)`;
    } else if (action === "set-enabled") {
      await sql`select hub_private.set_admin_enabled(
        ${actor}::uuid,${subject as string}::uuid,${enabled as boolean}::boolean)`;
    } else if (action === "issue-grant") {
      const rows = await sql`select hub_private.issue_capability_grant(
        ${actor}::uuid,${subject as string}::uuid,
        ${capability as string},${scopeKind as string},${scopeKey as string},
        ${validUntil == null ? null : (validUntil as string)}::timestamptz) as id`;
      return response(200, { ok: true, grantId: rows[0]?.id });
    } else if (action === "revoke-grant") {
      await sql`select hub_private.revoke_capability_grant(
        ${actor}::uuid,${grantId as string}::uuid)`;
    }
    return response(200, { ok: true });
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


