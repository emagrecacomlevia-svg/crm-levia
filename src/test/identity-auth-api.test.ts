import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  refreshTokens,
  revokeToken,
  signIn,
  verifyIdentity,
} from "@/modules/identity/server/auth-api.server";

const previousUrl = process.env["SUPABASE_URL"];
const previousKey = process.env["SUPABASE_PUBLISHABLE_KEY"];

beforeEach(() => {
  process.env["SUPABASE_URL"] = "https://synthetic.supabase.co";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_synthetic";
});

afterEach(() => {
  if (previousUrl === undefined) delete process.env["SUPABASE_URL"];
  else process.env["SUPABASE_URL"] = previousUrl;
  if (previousKey === undefined) delete process.env["SUPABASE_PUBLISHABLE_KEY"];
  else process.env["SUPABASE_PUBLISHABLE_KEY"] = previousKey;
  vi.unstubAllGlobals();
});

const goodTokens = {
  access_token: "synthetic-access-token",
  refresh_token: "synthetic-refresh-token",
  expires_in: 3600,
  user: { id: "synthetic-user" },
};

describe("HUB-04 GoTrue server adapter", () => {
  it("logs in through HTTPS without an administrative key", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(goodTokens), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    expect(await signIn("user@example.invalid", "synthetic-password")).toEqual({
      kind: "ok",
      data: {
        accessToken: "synthetic-access-token",
        refreshToken: "synthetic-refresh-token",
        expiresIn: 3600,
        userId: "synthetic-user",
      },
    });
    const input = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(input[0]).toBe("https://synthetic.supabase.co/auth/v1/token?grant_type=password");
    expect(input[1].headers).toMatchObject({ apikey: "sb_publishable_synthetic" });
    expect(input[1].cache).toBe("no-store");
  });

  it("rejects invalid credentials without exposing account details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect(await signIn("user@example.invalid", "incorrect")).toEqual({ kind: "invalid" });
  });

  it("refreshes rotated tokens for the same verified identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(goodTokens))));
    const refreshed = await refreshTokens("synthetic-refresh-token");
    expect(refreshed.kind).toBe("ok");
  });

  it("verifies identity using a bearer token", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "synthetic-user", email: "user@example.invalid" })),
      );
    vi.stubGlobal("fetch", spy);
    expect(await verifyIdentity("synthetic-access-token")).toEqual({
      kind: "ok",
      data: { id: "synthetic-user", email: "user@example.invalid" },
    });
    const input = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(input[1].headers).toMatchObject({ authorization: "Bearer synthetic-access-token" });
  });

  it("handles successful logout with HTTP 204 No Content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await revokeToken("synthetic-access-token")).toBe(true);
  });

  it("fails closed on malformed Auth responses and unavailable configuration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ role: "admin" }))),
    );
    expect((await signIn("user@example.invalid", "synthetic")).kind).toBe("unavailable");
    delete process.env["SUPABASE_URL"];
    expect((await signIn("user@example.invalid", "synthetic")).kind).toBe("unavailable");
  });
});
