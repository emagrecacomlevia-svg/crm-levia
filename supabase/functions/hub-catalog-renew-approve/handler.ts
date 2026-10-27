/**
 * Independent HUB-05 renewal approval ONLY. This Endpoint NEVER issues grants.
 * Handler's dependencies are injectable in isolated tests only. Production entrypoint
 * always uses real Supabase Auth and strict-TLS PostgreSQL.
 */
import postgres from "npm:postgres@3.4.7";
import { boundedJson, edgeConfiguration, verifiedSessionId } from "../_shared/configuration.ts";

function answer(status: number, data: Record<string, unknown>) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
function uuid(x: unknown): x is string {
  return typeof x === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
}
function approvalPayload(x: unknown): x is {
  action: "approve-renewal";
  requestRef: string;
  subject: string;
  validUntil: string;
} {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  if (Object.keys(p).sort().join(",") !== "action,requestRef,subject,validUntil" ||
    p.action !== "approve-renewal" ||
    !uuid(p.subject) ||
    typeof p.requestRef !== "string" ||
    !/^LEVIA-HUB05R-[A-Z0-9]{12,32}$/.test(p.requestRef) ||
    typeof p.validUntil !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(p.validUntil)
  ) return false;
  const at = Date.parse(p.validUntil);
  return Number.isFinite(at) && at > Date.now() + 60 * 60 * 1000 &&
    at <= Date.now() + 7 * 24 * 60 * 60 * 1000;
}

export async function hubCatalogRenewalApprovalHandler(
  request: Request,
  dependencies: { fetcher?: typeof fetch; connect?: typeof postgres } = {},
) {
  if (request.method !== "POST") return answer(405, { ok: false });
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))
    return answer(401, { ok: false });
  const cfg = edgeConfiguration();
  if (!cfg) return answer(503, { ok: false });
  let input: unknown;
  try {
    input = await boundedJson(request, 1024);
  } catch (error) {
    return answer(error instanceof RangeError ? 413 : 400, { ok: false });
  }
  if (!approvalPayload(input)) return answer(400, { ok: false });

  let approver: string;
  try {
    const result = await (dependencies.fetcher ?? fetch)(
      cfg.authOrigin + "/auth/v1/user",
      {
        headers: { apikey: cfg.key, authorization: bearer },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!result.ok) return answer(401, { ok: false });
    const verified: unknown = await result.json();
    approver = (verified as { id?: unknown })?.id as string;
    if (!uuid(approver)) return answer(401, { ok: false });
  } catch {
    return answer(503, { ok: false });
  }
  const session = verifiedSessionId(bearer);
  if (!session) return answer(401, { ok: false });

  const p = input as {
    requestRef: string;
    subject: string;
    validUntil: string;
  };
  const sql = (dependencies.connect ?? postgres)(cfg.rawUrl, {
    password: cfg.password,
    ssl: { rejectUnauthorized: true, ...(cfg.ca ? { ca: cfg.ca } : {}) },
    max: 1, prepare: false, connect_timeout: 8, idle_timeout: 3,
  });
  try {
    await sql.begin(async (tx) => {
      // The private function validates session ownership, original historical
      // independent bootstrap provenance and exact original admin identity.
      // The INSERT and approval audit event commit atomically.
      await tx.unsafe(
        "select hub_private.approve_catalog_renewal($1::uuid,$2::uuid,$3::uuid,$4,$5::timestamptz)",
        [approver, session, p.subject, p.requestRef, p.validUntil],
      );
    });
    return answer(200, { ok: true, approvalRecorded: true });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === "42501") return answer(403, { ok: false });
    if (code === "23505") return answer(409, { ok: false });
    return answer(503, { ok: false });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
