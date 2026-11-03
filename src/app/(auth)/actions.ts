"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  acceptInvite,
  authenticate,
  AuthError,
  createSession,
  deleteSession,
  normalizeEmail,
  signUp,
  switchOrg,
} from "@/server/auth";
import { rateLimit, resetRateLimit } from "@/server/rate-limit";
import { safeNext } from "@/lib/redirects";
import { clearSessionCookie, getSessionToken, requireActionCtx, setSessionCookie } from "@/lib/session";

export type FormState = { error?: string; values?: Record<string, string> } | null;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}


const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").max(200),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
  orgName: z.string().trim().max(100).optional(),
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    orgName: String(formData.get("orgName") ?? ""),
  };
  const values = { name: raw.name, email: raw.email, orgName: raw.orgName };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  if (!(await rateLimit(db, `signup:${await clientIp()}`, 10, 3600))) {
    return { error: "Too many sign-ups from your network. Try again later.", values };
  }

  const inviteToken = String(formData.get("invite") ?? "");
  let userId: string;
  let orgId: string;
  try {
    const orgName = parsed.data.orgName || `${parsed.data.name.split(" ")[0]}'s workspace`;
    ({ userId, orgId } = await signUp(db, { ...parsed.data, orgName }));
    if (inviteToken) orgId = await acceptInvite(db, inviteToken, userId);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message, values };
    throw e;
  }
  const { token, expiresAt } = await createSession(db, userId, orgId);
  await setSessionCookie(token, expiresAt);
  redirect(inviteToken ? "/app" : "/app?welcome=1");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: "Enter your email and password.", values };

  const limitKey = `login:${normalizeEmail(email)}:${await clientIp()}`;
  if (!(await rateLimit(db, limitKey, 10, 15 * 60))) {
    return { error: "Too many attempts. Wait 15 minutes and try again.", values };
  }

  const userId = await authenticate(db, email, password);
  if (!userId) return { error: "That email and password don't match.", values };
  await resetRateLimit(db, limitKey);

  const inviteToken = String(formData.get("invite") ?? "");
  let orgId: string | null = null;
  if (inviteToken) {
    try {
      orgId = await acceptInvite(db, inviteToken, userId);
    } catch (e) {
      if (e instanceof AuthError) return { error: e.message, values };
      throw e;
    }
  }
  const { token, expiresAt } = await createSession(db, userId, orgId);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await deleteSession(db, token);
  await clearSessionCookie();
  redirect("/login");
}

export async function switchOrgAction(formData: FormData) {
  const { session } = await requireActionCtx();
  const orgId = String(formData.get("orgId") ?? "");
  await switchOrg(db, session.sessionId, session.user.id, orgId);
  redirect("/app");
}

export async function acceptInviteAction(formData: FormData) {
  const { session } = await requireActionCtx();
  const token = String(formData.get("token") ?? "");
  const orgId = await acceptInvite(db, token, session.user.id);
  await switchOrg(db, session.sessionId, session.user.id, orgId);
  redirect("/app");
}
