/**
 * Supabase Auth GoTrue adapter. Runs on the server only. Never returns a token
 * to the browser, and never uses a service_role or secret admin key.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}
export interface VerifiedIdentity {
  id: string;
  email: string | null;
}

export type AuthApiResult<T> =
  { kind: "ok"; data: T } | { kind: "invalid" } | { kind: "unavailable" };

function config(): { origin: string; key: string } | null {
  const raw = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!raw || !key) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return null;
    }
    return { origin: url.origin, key };
  } catch {
    return null;
  }
}

async function goTrue(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, string>,
  bearer?: string,
): Promise<AuthApiResult<unknown>> {
  const settings = config();
  if (!settings) return { kind: "unavailable" };
  try {
    const response = await fetch(settings.origin + path, {
      method,
      headers: {
        apikey: settings.key,
        "content-type": "application/json",
        ...(bearer ? { authorization: "Bearer " + bearer } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { kind: "invalid" };
    }
    if (!response.ok) return { kind: "unavailable" };
    if (response.status === 204) return { kind: "ok", data: null };
    return { kind: "ok", data: (await response.json()) as unknown };
  } catch {
    return { kind: "unavailable" };
  }
}

function decodeTokens(value: unknown): AuthApiResult<AuthTokens> {
  if (typeof value !== "object" || value === null) return { kind: "unavailable" };
  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;
  if (
    typeof v.access_token !== "string" ||
    !v.access_token ||
    typeof v.refresh_token !== "string" ||
    !v.refresh_token ||
    typeof v.expires_in !== "number" ||
    !Number.isFinite(v.expires_in) ||
    v.expires_in <= 0 ||
    !user ||
    typeof user.id !== "string" ||
    !user.id
  )
    return { kind: "unavailable" };
  return {
    kind: "ok",
    data: {
      accessToken: v.access_token,
      refreshToken: v.refresh_token,
      expiresIn: v.expires_in,
      userId: user.id,
    },
  };
}

export async function signIn(email: string, password: string): Promise<AuthApiResult<AuthTokens>> {
  const result = await goTrue("/auth/v1/token?grant_type=password", "POST", {
    email,
    password,
  });
  return result.kind === "ok" ? decodeTokens(result.data) : result;
}

export async function refreshTokens(refreshToken: string): Promise<AuthApiResult<AuthTokens>> {
  const result = await goTrue("/auth/v1/token?grant_type=refresh_token", "POST", {
    refresh_token: refreshToken,
  });
  return result.kind === "ok" ? decodeTokens(result.data) : result;
}

export async function verifyIdentity(
  accessToken: string,
): Promise<AuthApiResult<VerifiedIdentity>> {
  const result = await goTrue("/auth/v1/user", "GET", undefined, accessToken);
  if (result.kind !== "ok") return result;
  const data = result.data;
  if (!data || typeof data !== "object") return { kind: "unavailable" };
  const user = data as Record<string, unknown>;
  if (typeof user.id !== "string" || !user.id) return { kind: "unavailable" };
  return {
    kind: "ok",
    data: { id: user.id, email: typeof user.email === "string" ? user.email : null },
  };
}

export async function revokeToken(accessToken: string): Promise<boolean> {
  const result = await goTrue("/auth/v1/logout", "POST", undefined, accessToken);
  return result.kind === "ok";
}
