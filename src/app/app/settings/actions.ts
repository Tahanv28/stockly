"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireActionCtx } from "@/lib/session";
import { AuthError, createInvite, removeMember, renameOrg } from "@/server/auth";
import type { Role } from "@/db/schema";

export type SettingsState = { error?: string; ok?: boolean; inviteUrl?: string } | null;

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function renameOrgAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { ctx } = await requireActionCtx();
  try {
    await renameOrg(db, ctx, String(fd.get("name") ?? ""));
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function createInviteAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { ctx } = await requireActionCtx();
  const role = (String(fd.get("role") ?? "member") === "admin" ? "admin" : "member") as Role;
  try {
    const token = await createInvite(db, ctx, role);
    return { ok: true, inviteUrl: `${appUrl()}/invite/${token}` };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
}

export async function removeMemberAction(fd: FormData) {
  const { ctx } = await requireActionCtx();
  await removeMember(db, ctx, String(fd.get("userId") ?? ""));
  revalidatePath("/app/settings");
}
