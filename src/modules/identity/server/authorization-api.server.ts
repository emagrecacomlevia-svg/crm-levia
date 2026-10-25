import { CAPABILITIES, type Capability, type ScopeKind } from "../domain/permissions";
import { getPublicSupabaseSettings } from "./auth-api.server";

export type AuthorizationResult = "allow" | "deny" | "unavailable";

export interface AuthorizationRequest {
  capability: Capability;
  scopeKind: ScopeKind;
  scopeKey: string;
}

export function isAuthorizationRequest(value: unknown): value is AuthorizationRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["capability"] === "string" &&
    (CAPABILITIES as readonly string[]).includes(v["capability"]) &&
    (v["scopeKind"] === "module" || v["scopeKind"] === "resource") &&
    typeof v["scopeKey"] === "string" &&
    /^[a-z][a-z0-9:_-]{0,127}$/.test(v["scopeKey"]) &&
    v["scopeKey"] !== "all" &&
    v["scopeKey"] !== "global"
  );
}

/**
 * Server-only adapter to dedicated Supabase Edge Function.
 * No client-provided identity, configurable external URL, or service_role.
 * Edge Function verifies the token again and uses parameterized SQL.
 */
export async function authorizeViaSupabase(
  verifiedAccessToken: string,
  request: AuthorizationRequest,
): Promise<AuthorizationResult> {
  const config = getPublicSupabaseSettings();
  if (!config || !verifiedAccessToken || !isAuthorizationRequest(request)) return "unavailable";
  try {
    const result = await fetch(config.origin + "/functions/v1/hub-authorize", {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: "Bearer " + verifiedAccessToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (result.status === 401 || result.status === 403) return "deny";
    if (!result.ok) return "unavailable";
    const data: unknown = await result.json();
    if (!data || typeof data !== "object") return "unavailable";
    const allowed = (data as Record<string, unknown>)["allowed"];
    return allowed === true ? "allow" : allowed === false ? "deny" : "unavailable";
  } catch {
    return "unavailable";
  }
}
