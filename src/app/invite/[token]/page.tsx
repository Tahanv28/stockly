import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { findInvite } from "@/server/auth";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/logo";
import { Button, Card, LinkButton } from "@/components/ui";
import { acceptInviteAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Invite" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const found = await findInvite(db, token);
  const session = await getSession();

  if (found && !session) redirect(`/signup?invite=${encodeURIComponent(token)}`);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center">
      <Logo className="mb-8 text-lg" />
      <Card className="w-full max-w-sm p-6 text-center">
        {found ? (
          <>
            <h1 className="text-lg font-semibold">Join {found.org.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              You&apos;re signed in as {session?.user.email}. Accept to get access to this workspace.
            </p>
            <form action={acceptInviteAction} className="mt-5">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">Accept invite</Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Invite not valid</h1>
            <p className="mt-1 text-sm text-neutral-500">
              This invite link has expired or was already used. Ask your teammate for a new one.
            </p>
            <LinkButton href={session ? "/app" : "/login"} variant="secondary" className="mt-5 w-full">
              {session ? "Go to Stockly" : "Log in"}
            </LinkButton>
          </>
        )}
      </Card>
    </main>
  );
}
