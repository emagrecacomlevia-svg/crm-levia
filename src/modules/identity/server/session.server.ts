import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { getPublicSupabaseSettings } from "./auth-api.server";

export interface LeviaSession {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  issuedAt?: number;
}

function cookieSettings() {
  const secure = process.env["NODE_ENV"] !== "development" && process.env["NODE_ENV"] !== "test";
  return { secure, name: secure ? "__Host-levia-session" : "levia-dev-session" };
}

/** Local logout must work even when the remote session service is unavailable. */
export function clearLeviaSession() {
  const { name, secure } = cookieSettings();
  deleteCookie(name, { path: "/", secure, httpOnly: true, sameSite: "lax" });
}

/** Opaque AES-GCM envelope issued by Supabase; tokens never enter client JS. */
export async function getLeviaSession() {
  const config = getPublicSupabaseSettings();
  if (!config) throw new Error("Session service unavailable");
  const { name, secure } = cookieSettings();
  const cookie = getCookie(name);
  let data: LeviaSession = {};
  async function call(body: Record<string, unknown>, bearer?: string) {
    const response = await fetch(config!.origin + "/functions/v1/hub-session", {
      method: "POST",
      headers: {
        apikey: config!.key,
        "content-type": "application/json",
        ...(bearer ? { authorization: "Bearer " + bearer } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 500) throw new Error("Session service unavailable");
    return response.ok ? await response.json() : null;
  }
  if (cookie) {
    const opened = await call({ action: "open", envelope: cookie });
    if (opened?.ok && opened.data && typeof opened.data.userId === "string") data = opened.data;
  }
  return {
    get data() {
      return data;
    },
    async clear() {
      data = {};
      clearLeviaSession();
    },
    async update(next: LeviaSession) {
      const sealed = await call({ action: "seal", data: next }, next.accessToken);
      if (!sealed?.ok || typeof sealed.envelope !== "string" || sealed.envelope.length > 3800)
        throw new Error("Session denied");
      setCookie(name, sealed.envelope, {
        maxAge: 7 * 86400,
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      });
      data = next;
    },
  };
}
