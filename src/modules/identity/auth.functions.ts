import { isRecoveryCredential, type RecoveryCredential } from "./recovery";
import { createServerFn } from "@tanstack/react-start";

import {
  activatePassword,
  resetPasswordWithAccessToken,
  refreshTokens,
  revokeToken,
  signIn,
  verifyIdentity,
  type VerifiedIdentity,
  type AuthTokens,
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

async function establishSession(tokens: AuthTokens) {
  const session = await getLeviaSession();
  const state: LeviaSession = {
    userId: tokens.userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: Date.now() + tokens.expiresIn * 1000,
    issuedAt: Date.now(),
  };
  await session.clear();
  await session.update(state);
}

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
      await establishSession(result.data);
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
  .validator((data: { credential: RecoveryCredential; password: string }) => {
    if (
      !data ||
      !isRecoveryCredential(data.credential) ||
      typeof data.password !== "string" ||
      data.password.length < 12 ||
      data.password.length > 128
    ) {
      throw new Error("Use um link válido e uma senha com 12 a 128 caracteres.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const result =
      data.credential.kind === "hash"
        ? await activatePassword(data.credential.value, data.password)
        : await resetPasswordWithAccessToken(data.credential.value, data.password);
    if (result.kind === "password-updated-login-failed")
      return {
        ok: false,
        passwordSaved: true,
        message:
          "A senha foi salva, mas o Supabase não confirmou o login com ela. Não redefina novamente; informe esta mensagem ao suporte.",
      };
    if (result.kind !== "ok")
      return {
        ok: false,
        message:
          "Não foi possível concluir a recuperação. O link pode estar expirado ou a senha pode ter sido recusada.",
      };
    try {
      await establishSession(result.data);
      return { ok: true, message: "Senha salva e login confirmado. Acessando o HUB..." };
    } catch {
      await revokeToken(result.data.accessToken);
      return {
        ok: false,
        passwordSaved: true,
        message:
          "Senha salva e validada, mas não foi possível abrir a sessão do HUB. Informe esta mensagem ao suporte.",
      };
    }
  });

/** Private backend helper. Never expose bearer tokens via a createServerFn return. */
export async function getVerifiedServerAccessToken(): Promise<string | null> {
  try {
    const session = await getLeviaSession();
    const status = await identityForSession(session);
    return status.state === "authenticated" ? (session.data.accessToken ?? null) : null;
  } catch {
    return null;
  }
}
