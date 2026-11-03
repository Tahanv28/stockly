import { and, eq, gt, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import {
  users,
  organizations,
  memberships,
  sessions,
  invites,
  type Role,
} from "@/db/schema";
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";

export const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export class AuthError extends Error {}

export type Ctx = { userId: string; orgId: string; role: Role };

export type SessionInfo = {
  sessionId: string;
  expiresAt: Date;
  user: { id: string; name: string; email: string };
  org: { id: string; name: string; plan: string };
  role: Role;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signUp(
  db: DB,
  input: { name: string; email: string; password: string; orgName: string },
) {
  const email = normalizeEmail(input.email);
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new AuthError("An account with this email already exists.");

  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, name: input.name.trim(), passwordHash })
      .returning();
    const [org] = await tx
      .insert(organizations)
      .values({ name: input.orgName.trim() })
      .returning();
    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
    return { userId: user.id, orgId: org.id };
  });
}

/** Returns the user id if the credentials are valid, otherwise null. */
export async function authenticate(db: DB, emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    // Spend the same time hashing so response time doesn't reveal which emails exist.
    await verifyPassword(password, await getDummyHash());
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user.id : null;
}

export async function createSession(db: DB, userId: string, orgId: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(sessions).values({ id: sha256(token), userId, orgId, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(db: DB, token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function validateSession(db: DB, token: string): Promise<SessionInfo | null> {
  const sessionId = sha256(token);
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return null;

  // Resolve the active organization, falling back to any org the user belongs to.
  let membership = session.orgId
    ? await db.query.memberships.findFirst({
        where: and(eq(memberships.userId, user.id), eq(memberships.orgId, session.orgId)),
      })
    : undefined;
  if (!membership) {
    membership = await db.query.memberships.findFirst({
      where: eq(memberships.userId, user.id),
    });
    if (!membership) return null;
    await db.update(sessions).set({ orgId: membership.orgId }).where(eq(sessions.id, sessionId));
  }
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.orgId),
  });
  if (!org) return null;

  // Sliding expiration: extend sessions that are used.
  let expiresAt = session.expiresAt;
  if (expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY) {
    expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
  }

  return {
    sessionId,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email },
    org: { id: org.id, name: org.name, plan: org.plan },
    role: membership.role,
  };
}

export async function listUserOrgs(db: DB, userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.name);
}

export async function switchOrg(db: DB, sessionId: string, userId: string, orgId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)),
  });
  if (!membership) throw new AuthError("You are not a member of that workspace.");
  await db.update(sessions).set({ orgId }).where(eq(sessions.id, sessionId));
}

// ---------------------------------------------------------------------------
// Team invites
// ---------------------------------------------------------------------------

export function canManageTeam(role: Role) {
  return role === "owner" || role === "admin";
}

export async function createInvite(db: DB, ctx: Ctx, role: Role) {
  if (!canManageTeam(ctx.role)) throw new AuthError("Only owners and admins can invite people.");
  if (role === "owner") throw new AuthError("Invites can't grant the owner role.");
  const token = randomToken();
  await db.insert(invites).values({
    orgId: ctx.orgId,
    role,
    tokenHash: sha256(token),
    createdBy: ctx.userId,
    expiresAt: new Date(Date.now() + 7 * DAY),
  });
  return token;
}

export async function findInvite(db: DB, token: string) {
  const invite = await db.query.invites.findFirst({
    where: and(
      eq(invites.tokenHash, sha256(token)),
      isNull(invites.acceptedAt),
      gt(invites.expiresAt, new Date()),
    ),
  });
  if (!invite) return null;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, invite.orgId),
  });
  return org ? { invite, org } : null;
}

export async function acceptInvite(db: DB, token: string, userId: string) {
  const found = await findInvite(db, token);
  if (!found) throw new AuthError("This invite link is invalid or has expired.");
  const { invite } = found;
  await db.transaction(async (tx) => {
    await tx
      .insert(memberships)
      .values({ orgId: invite.orgId, userId, role: invite.role })
      .onConflictDoNothing();
    await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
  });
  return invite.orgId;
}

export async function listMembers(db: DB, orgId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(memberships.createdAt);
}

export async function removeMember(db: DB, ctx: Ctx, userId: string) {
  if (!canManageTeam(ctx.role)) throw new AuthError("Only owners and admins can remove people.");
  const target = await db.query.memberships.findFirst({
    where: and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)),
  });
  if (!target) throw new AuthError("That person is not in this workspace.");
  if (target.role === "owner") throw new AuthError("The owner can't be removed.");
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)));
}

export async function renameOrg(db: DB, ctx: Ctx, nameInput: string) {
  if (!canManageTeam(ctx.role)) throw new AuthError("Only owners and admins can rename the workspace.");
  const name = nameInput.trim();
  if (!name) throw new AuthError("Enter a name.");
  await db.update(organizations).set({ name: name.slice(0, 100) }).where(eq(organizations.id, ctx.orgId));
}
