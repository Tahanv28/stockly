import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const invite = typeof sp.invite === "string" ? sp.invite : undefined;
  if (!invite && (await getSession())) redirect(next ?? "/app");
  return <LoginForm next={next} invite={invite} />;
}
