import { EncryptJWT, jwtDecrypt } from "npm:jose@6.1.3";
import postgres from "npm:postgres@3.4.7";
import { boundedJson, edgeConfiguration, verifiedSessionId } from "../_shared/configuration.ts";

const issuer = "levia-hub-session-v1";
function reply(status: number, data: unknown) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false });
  const cfg = edgeConfiguration();
  // Built-in secret remains inside Supabase. No web-host signing secret required.
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cfg || !secret) return reply(503, { ok: false });
  const key = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(issuer + ":" + secret)),
  );
  let sql: ReturnType<typeof postgres> | undefined;
  try {
    const body = (await boundedJson(req, 12000)) as Record<string, unknown>;
    if (!body || typeof body !== "object") return reply(400, { ok: false });
    let data: Record<string, unknown>;
    let sessionId: string | null;
    let expiresAt: number;
    if (body.action === "seal") {
      const bearer = req.headers.get("authorization") ?? "";
      if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer)) return reply(401, { ok: false });
      const verified = await fetch(cfg.authOrigin + "/auth/v1/user", {
        headers: { apikey: cfg.key, authorization: bearer },
        signal: AbortSignal.timeout(8000),
      });
      if (!verified.ok) return reply(401, { ok: false });
      const user = await verified.json();
      sessionId = verifiedSessionId(bearer);
      const supplied = body.data as Record<string, unknown>;
      if (
        !sessionId ||
        !supplied ||
        supplied.accessToken !== bearer.slice(7) ||
        supplied.userId !== user.id ||
        typeof supplied.refreshToken !== "string" ||
        supplied.refreshToken.length > 1024 ||
        typeof supplied.accessExpiresAt !== "number"
      )
        return reply(400, { ok: false });
      data = {
        userId: user.id,
        accessToken: supplied.accessToken,
        refreshToken: supplied.refreshToken,
        accessExpiresAt: supplied.accessExpiresAt,
        issuedAt: Date.now(),
      };
      expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;
    } else if (body.action === "open" && typeof body.envelope === "string") {
      const decrypted = await jwtDecrypt(body.envelope, key, {
        issuer,
        audience: "levia-hub-ssr",
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      });
      data = decrypted.payload.data as Record<string, unknown>;
      sessionId = decrypted.payload.sessionId as string;
      expiresAt = decrypted.payload.exp!;
      if (!data || typeof data.userId !== "string" || typeof sessionId !== "string")
        return reply(401, { ok: false });
    } else return reply(400, { ok: false });
    sql = postgres(cfg.rawUrl, {
      password: cfg.password,
      ssl: { rejectUnauthorized: true, ...(cfg.ca ? { ca: cfg.ca } : {}) },
      max: 1,
      prepare: false,
      connect_timeout: 8,
    });
    const rows =
      await sql`select hub_private.session_is_active(${data.userId as string}::uuid, ${sessionId}::uuid) as active,
      (select extract(epoch from created_at)::bigint from auth.sessions where id=${sessionId}::uuid) as created`;
    if (!rows[0]?.active) return reply(401, { ok: false });
    data.issuedAt = Number(rows[0].created) * 1000;
    expiresAt = Math.min(expiresAt, Number(rows[0].created) + 7 * 86400);
    if (body.action === "open") return reply(200, { ok: true, data });
    const envelope = await new EncryptJWT({ data, sessionId })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuer(issuer)
      .setAudience("levia-hub-ssr")
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .encrypt(key);
    return reply(200, { ok: true, envelope });
  } catch (error) {
    return reply(error instanceof RangeError ? 413 : 401, { ok: false });
  } finally {
    if (sql) await sql.end({ timeout: 2 });
  }
});
