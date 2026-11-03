import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { findInvite } from "@/server/auth";
import { getSession } from "@/lib/session";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const invite = typeof sp.invite === "string" ? sp.invite : undefined;
  if (!invite && (await getSession())) redirect("/app");
  const found = invite ? await findInvite(db, invite) : null;
  return <SignupForm invite={found ? invite : undefined} inviteOrgName={found?.org.name} />;
}
