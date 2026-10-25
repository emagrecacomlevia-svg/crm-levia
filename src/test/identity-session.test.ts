import { afterEach, expect, it, vi } from "vitest";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { clearLeviaSession, getLeviaSession } from "@/modules/identity/server/session.server";

vi.mock("@tanstack/react-start/server", () => ({
  deleteCookie: vi.fn(),
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("clears the production cookie even if the remote session service is down", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.mocked(getCookie).mockReturnValue("synthetic-envelope");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
  await expect(getLeviaSession()).rejects.toThrow("unavailable");
  clearLeviaSession();
  expect(deleteCookie).toHaveBeenCalledWith("__Host-levia-session", {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
});

it("stores only the authenticated opaque envelope with production cookie flags", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.mocked(getCookie).mockReturnValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          envelope: "synthetic-authenticated-envelope",
        }),
      ),
    ),
  );
  const session = await getLeviaSession();
  await session.update({ userId: "synthetic-user", accessToken: "synthetic-token" });
  expect(setCookie).toHaveBeenCalledWith(
    "__Host-levia-session",
    "synthetic-authenticated-envelope",
    {
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 604800,
    },
  );
});
