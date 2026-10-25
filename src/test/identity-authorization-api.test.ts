import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeViaSupabase,
  isAuthorizationRequest,
} from "@/modules/identity/server/authorization-api.server";

const previousUrl = process.env["SUPABASE_URL"];
const previousKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
const request = { capability: "crm.read", scopeKind: "module", scopeKey: "crm" } as const;
beforeEach(() => {
  process.env["SUPABASE_URL"] = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_synthetic";
});
afterEach(() => {
  if (previousUrl === undefined) delete process.env["SUPABASE_URL"];
  else process.env["SUPABASE_URL"] = previousUrl;
  if (previousKey === undefined) delete process.env["SUPABASE_PUBLISHABLE_KEY"];
  else process.env["SUPABASE_PUBLISHABLE_KEY"] = previousKey;
  vi.unstubAllGlobals();
});

describe("HUB-04 server authorization transport", () => {
  it("rejects invalid and widened scopes before calling backend", () => {
    expect(isAuthorizationRequest(request)).toBe(true);
    expect(isAuthorizationRequest({ ...request, scopeKey: "global" })).toBe(false);
    expect(isAuthorizationRequest({ ...request, scopeKind: "unknown" })).toBe(false);
    expect(isAuthorizationRequest({ ...request, capability: "admin.all" })).toBe(false);
  });
  it("uses the fixed Supabase origin, bearer and no-store", async () => {
    const spy = vi.fn().mockResolvedValue(new Response('{"allowed":true}'));
    vi.stubGlobal("fetch", spy);
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("allow");
    const args = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toBe("https://dfhjfajbmnsgrklhqtjk.supabase.co/functions/v1/hub-authorize");
    expect(args[1].headers).toMatchObject({ authorization: "Bearer synthetic-token" });
    expect(args[1].cache).toBe("no-store");
  });
  it("denies negative decisions and invalid token responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"allowed":false}')));
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("deny");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("deny");
  });
  it("never grants access on backend failure or untrusted payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"allowed":"true"}')));
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    expect(await authorizeViaSupabase("synthetic-token", request)).toBe("unavailable");
  });
});
