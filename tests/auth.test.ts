import { describe, expect, it } from "vitest";
import { db, makeWorkspace } from "./helpers";
import {
  acceptInvite,
  authenticate,
  createInvite,
  createSession,
  deleteSession,
  signUp,
  switchOrg,
  validateSession,
  AuthError,
  removeMember,
} from "@/server/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { rateLimit } from "@/server/rate-limit";

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("s3cret password");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("accounts and sessions", () => {
  it("signs up, logs in, validates and ends sessions", async () => {
    const { userId, orgId } = await signUp(db, {
      name: "Ann",
      email: "  Ann@Example.com ",
      password: "long enough pw",
      orgName: "Ann's Shop",
    });
    await expect(
      signUp(db, { name: "Ann2", email: "ann@example.com", password: "long enough pw", orgName: "X" }),
    ).rejects.toThrow(AuthError);

    expect(await authenticate(db, "ANN@example.com", "long enough pw")).toBe(userId);
    expect(await authenticate(db, "ann@example.com", "nope")).toBeNull();
    expect(await authenticate(db, "nobody@example.com", "nope")).toBeNull();

    const { token } = await createSession(db, userId, orgId);
    const session = await validateSession(db, token);
    expect(session?.user.email).toBe("ann@example.com");
    expect(session?.org.id).toBe(orgId);
    expect(session?.role).toBe("owner");
    expect(await validateSession(db, "not-a-token")).toBeNull();

    await deleteSession(db, token);
    expect(await validateSession(db, token)).toBeNull();
  });

  it("invites teammates and lets them switch workspaces", async () => {
    const owner = await makeWorkspace("Owner Co");
    const other = await makeWorkspace("Other Co");

    const token = await createInvite(db, owner, "member");
    const joinedOrg = await acceptInvite(db, token, other.userId);
    expect(joinedOrg).toBe(owner.orgId);
    await expect(acceptInvite(db, token, other.userId)).rejects.toThrow(AuthError); // single use

    const { token: sessionToken } = await createSession(db, other.userId, other.orgId);
    const s = await validateSession(db, sessionToken);
    await switchOrg(db, s!.sessionId, other.userId, owner.orgId);
    const s2 = await validateSession(db, sessionToken);
    expect(s2?.org.id).toBe(owner.orgId);
    expect(s2?.role).toBe("member");

    // Members can't invite or remove people.
    const memberCtx = { userId: other.userId, orgId: owner.orgId, role: "member" as const };
    await expect(createInvite(db, memberCtx, "member")).rejects.toThrow(AuthError);
    await expect(removeMember(db, memberCtx, owner.userId)).rejects.toThrow(AuthError);
    // Owner can't be removed even by an admin.
    await expect(removeMember(db, { ...memberCtx, role: "admin" }, owner.userId)).rejects.toThrow(AuthError);

    // A stranger can't switch into a workspace they don't belong to.
    const stranger = await makeWorkspace("Stranger");
    const { token: st } = await createSession(db, stranger.userId, stranger.orgId);
    const ss = await validateSession(db, st);
    await expect(switchOrg(db, ss!.sessionId, stranger.userId, owner.orgId)).rejects.toThrow(AuthError);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within the window", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(await rateLimit(db, key, 3, 60)).toBe(true);
    expect(await rateLimit(db, key, 3, 60)).toBe(false);
  });
});
