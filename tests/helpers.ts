import { db } from "@/db";
import { signUp, type Ctx } from "@/server/auth";
import { randomToken } from "@/lib/crypto";

export { db };

export async function makeWorkspace(name = "Test Co"): Promise<Ctx> {
  const email = `user-${randomToken(6)}@example.com`;
  const { userId, orgId } = await signUp(db, {
    name: "Tester",
    email,
    password: "correct horse battery",
    orgName: name,
  });
  return { userId, orgId, role: "owner" };
}
