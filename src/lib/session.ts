import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { validateSession, type Ctx, type SessionInfo } from "@/server/auth";

export const SESSION_COOKIE = "stockly_session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The current session, or null. Deduplicated within one request. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  return validateSession(db, token);
});

/** For pages: redirects to /login when signed out. */
export async function requireSession(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * For Server Actions: re-validates the session on every call (never trust the
 * client) and refreshes the cookie so active users stay signed in.
 */
export async function requireActionCtx(): Promise<{ ctx: Ctx; session: SessionInfo }> {
  const token = await getSessionToken();
  const session = token ? await validateSession(db, token) : null;
  if (!session || !token) redirect("/login");
  await setSessionCookie(token, session.expiresAt);
  return {
    session,
    ctx: { userId: session.user.id, orgId: session.org.id, role: session.role },
  };
}

export function toCtx(session: SessionInfo): Ctx {
  return { userId: session.user.id, orgId: session.org.id, role: session.role };
}
