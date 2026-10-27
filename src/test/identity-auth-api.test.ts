import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activatePassword,
  resetPasswordWithAccessToken,
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
    process.env["SUPABASE_URL"] = "invalid-url";
    expect((await signIn("user@example.invalid", "synthetic")).kind).toBe("unavailable");
  });
  it("changes password only after a valid one-use recovery token", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(goodTokens)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "synthetic-user" })));
    vi.stubGlobal("fetch", spy);
    expect((await activatePassword("synthetic-token-hash", "a-long-synthetic-password")).kind).toBe(
      "ok",
    );
    expect(spy.mock.calls[0]?.[0]).toBe("https://synthetic.supabase.co/auth/v1/verify");
    expect(spy.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { authorization: "Bearer synthetic-access-token" },
    });
  });
  it("does not update a password when recovery verification fails", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", spy);
    expect((await activatePassword("invalid-hash", "a-long-synthetic-password")).kind).toBe(
      "invalid",
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("standard recovery email", () => {
  it("validates the identity, updates the password, then revokes the recovery session", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "synthetic-user" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "synthetic-user" })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", spy);
    expect(
      await resetPasswordWithAccessToken("synthetic-access", "long-synthetic-password"),
    ).toEqual({ kind: "ok", data: null });
    expect(spy.mock.calls.map((call) => call[1].method)).toEqual(["GET", "PUT", "POST"]);
    expect(spy.mock.calls[2]?.[0]).toBe("https://synthetic.supabase.co/auth/v1/logout");
  });
  it("does not change passwords for forged or expired tokens", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", spy);
    expect(await resetPasswordWithAccessToken("forged", "long-synthetic-password")).toEqual({
      kind: "invalid",
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("does not report success when the provider rejects the password", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "synthetic-user" })))
      .mockResolvedValueOnce(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", spy);
    expect(
      await resetPasswordWithAccessToken("synthetic-access", "long-synthetic-password"),
    ).toEqual({ kind: "invalid" });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
