/** Hosted credentials stay inside Edge runtime; TLS verification is mandatory. */
export function edgeConfiguration() {
  const authOrigin = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  try {
    key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? key;
  } catch {
    return null;
  }
  const custom = Deno.env.get("LEVIA_DB_URL");
  const rawUrl = custom ?? Deno.env.get("SUPABASE_DB_URL");
  const password = custom ? Deno.env.get("LEVIA_DB_PASSWORD") : undefined;
  const ca = Deno.env.get("LEVIA_DB_CA_PEM");
  if (authOrigin !== "https://dfhjfajbmnsgrklhqtjk.supabase.co" || !key || !rawUrl) return null;
  try {
    const db = new URL(rawUrl);
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      (custom && db.search) ||
      db.hash ||
      db.pathname !== "/postgres" ||
      (db.port && db.port !== "5432") ||
      !["db.dfhjfajbmnsgrklhqtjk.supabase.co", "aws-1-sa-east-1.pooler.supabase.com"].includes(
        db.hostname,
      ) ||
      (custom && (db.password || !password || !ca?.includes("BEGIN CERTIFICATE")))
    )
      return null;
    // Hosted DB URL may include sslmode; explicit strict TLS options take precedence.
    db.search = "";
    return { authOrigin, key, rawUrl: db.toString(), password, ca };
  } catch {
    return null;
  }
}

// Called only AFTER Auth has verified this bearer token's signature/identity.
export function verifiedSessionId(bearer: string): string | null {
  try {
    const claims = JSON.parse(
      atob(bearer.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
    return typeof claims.session_id === "string" && /^[0-9a-f-]{36}$/i.test(claims.session_id)
      ? claims.session_id
      : null;
  } catch {
    return null;
  }
}

export async function boundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RangeError("body too large");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
