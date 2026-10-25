import { useSession } from "@tanstack/react-start/server";

export interface LeviaSession {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  issuedAt?: number;
}

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function useLeviaSession() {
  const password = process.env.LEVIA_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("LEVIA_SESSION_SECRET must be set with at least 32 characters");
  }
  const secure = process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
  return useSession<LeviaSession>({
    password,
    name: secure ? "__Host-levia-session" : "levia-dev-session",
    maxAge: SEVEN_DAYS,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    },
  });
}
