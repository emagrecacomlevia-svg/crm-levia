import { createServerFn } from "@tanstack/react-start";

import {
  activatePassword,
  refreshTokens,
  revokeToken,
  signIn,
  verifyIdentity,
  type VerifiedIdentity,
} from "./server/auth-api.server";
import { clearLeviaSession, getLeviaSession, type LeviaSession } from "./server/session.server";
import {
  authorizeViaSupabase,
  isAuthorizationRequest,
  type AuthorizationRequest,
} from "./server/authorization-api.server";

export type AuthStatus =
  | { state: "anonymous" }
  | { state: "authenticated"; user: VerifiedIdentity }
  | { state: "unavailable" };

type SessionStore = Awaited<ReturnType<typeof getLeviaSession>>;

async function currentIdentity(): Promise<AuthStatus> {
  try {
    return await identityForSession(await getLeviaSession());
  } catch {
    return { state: "unavailable" };
  }
}

async function identityForSession(session: SessionStore): Promise<AuthStatus> {
  const stored = session.data;
  if (!stored.userId || !stored.accessToken || !stored.refreshToken) {
    return { state: "anonymous" };
  }
  // The session cannot be renewed indefinitely. This is independent of token expiry.
  if (!stored.issuedAt || Date.now() - stored.issuedAt > 7 * 24 * 60 * 60 * 1000) {
    await session.clear();
    return { state: "anonymous" };
  }
  let token = stored.accessToken;
  if (!stored.accessExpiresAt || stored.accessExpiresAt <= Date.now() + 30_000) {
    const refreshed = await refreshTokens(stored.refreshToken);
    if (refreshed.kind === "invalid") {
      await session.clear();
      return { state: "anonymous" };
    }
    if (refreshed.kind !== "ok") return { state: "unavailable" };
    if (refreshed.data.userId !== stored.userId) {
      await session.clear();
      return { state: "anonymous" };
    }
    token = refreshed.data.accessToken;
    await session.update({
      ...stored,
      accessToken: token,
      refreshToken: refreshed.data.refreshToken,
      accessExpiresAt: Date.now() + refreshed.data.expiresIn * 1000,
    });
  }
  const checked = await verifyIdentity(token);
  if (checked.kind === "invalid") {
    await session.clear();
    return { state: "anonymous" };
  }
  if (checked.kind !== "ok") return { state: "unavailable" };
  if (checked.data.id !== stored.userId) {
    await session.clear();
    return { state: "anonymous" };
  }
  return { state: "authenticated", user: checked.data };
}

export const getAuthStatusFn = createServerFn({ method: "GET" }).handler(currentIdentity);

export const signInFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => {
    if (
      !data ||
      typeof data.email !== "string" ||
      typeof data.password !== "string" ||
      data.email.length > 254 ||
      data.password.length > 1024 ||
      !data.email.includes("@") ||
      !data.password
    )
      throw new Error("Credenciais inválidas.");
    return data;
  })
  .handler(async ({ data }) => {
    const result = await signIn(data.email.trim(), data.password);
    if (result.kind !== "ok") {
      return {
        ok: false,
        message:
          result.kind === "invalid"
            ? "E-mail ou senha inválidos."
            : "Autenticação indisponível. Tente novamente mais tarde.",
      };
    }
    try {
      const session = await getLeviaSession();
      const state: LeviaSession = {
        userId: result.data.userId,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        accessExpiresAt: Date.now() + result.data.expiresIn * 1000,
        issuedAt: Date.now(),
      };
      await session.clear();
      await session.update(state);
      return { ok: true, message: "" };
    } catch {
      return { ok: false, message: "Configuração de sessão indisponível." };
    }
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  let revoked = false;
  try {
    const session = await getLeviaSession();
    const access = session.data.accessToken;
    revoked = access ? await revokeToken(access) : true;
  } catch {
    // Preserve the distinction between local logout and verified remote revocation.
  } finally {
    clearLeviaSession();
  }
  return { ok: true, remoteRevoked: revoked };
});

/**
 * Every access decision runs exclusively in the backend. In particular:
 * - never infer a grant from a verified JWT alone;
 * - accept positive access only from the dedicated read-only DB adapter;
 * - preserve denial if the database/Edge Function is unavailable.
 */
async function authorizationStatus(request: AuthorizationRequest) {
  let session: SessionStore;
  try {
    session = await getLeviaSession();
  } catch {
    return { state: "unavailable" } as const;
  }
  const auth = await identityForSession(session);
  if (auth.state !== "authenticated") return { state: auth.state } as const;
  const token = session.data.accessToken;
  if (!token) return { state: "anonymous" } as const;
  const decision = await authorizeViaSupabase(token, request);
  if (decision === "allow") return { state: "authorized" } as const;
  if (decision === "deny") return { state: "denied" } as const;
  return { state: "authorization-unavailable" } as const;
}

export const getAdminAccessFn = createServerFn({ method: "GET" }).handler(async () =>
  authorizationStatus({ capability: "core.read", scopeKind: "module", scopeKey: "core" }),
);

export const checkCapabilityFn = createServerFn({ method: "POST" })
  .validator((data: AuthorizationRequest) => {
    if (!isAuthorizationRequest(data)) throw new Error("Invalid authorization request.");
    return data;
  })
  .handler(async ({ data }) => authorizationStatus(data));

export const activatePasswordFn = createServerFn({ method: "POST" })
  .validator((data: { tokenHash: string; password: string }) => {
    if (
      !data ||
      typeof data.tokenHash !== "string" ||
      !/^[a-f0-9]{64}$/i.test(data.tokenHash) ||
      typeof data.password !== "string" ||
      data.password.length < 12 ||
      data.password.length > 128
    ) {
      throw new Error("Use um link válido e uma senha com 12 a 128 caracteres.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const result = await activatePassword(data.tokenHash, data.password);
    if (result.kind !== "ok")
      return { ok: false, message: "Link inválido, expirado ou já utilizado." };
    // Password changes can revoke the recovery session; use the normal login next.
    await revokeToken(result.data.accessToken);
    return { ok: true, message: "Senha definida. Entre com seu e-mail e sua nova senha." };
  });
