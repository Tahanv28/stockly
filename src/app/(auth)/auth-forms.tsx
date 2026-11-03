"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Field, FormError, Input } from "@/components/ui";
import { loginAction, signupAction, type FormState } from "./actions";

export function LoginForm({ next, invite }: { next?: string; invite?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-neutral-500">Welcome back.</p>
      <form action={action} className="mt-5 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        {invite && <input type="hidden" name="invite" value={invite} />}
        <FormError message={state?.error} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-neutral-500">
        New to Stockly?{" "}
        <Link href={invite ? `/signup?invite=${encodeURIComponent(invite)}` : "/signup"} className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export function SignupForm({ invite, inviteOrgName }: { invite?: string; inviteOrgName?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, null);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">
        {inviteOrgName ? `Join ${inviteOrgName} on Stockly` : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {inviteOrgName ? "Create an account to accept the invite." : "Free to start. No card needed."}
      </p>
      <form action={action} className="mt-5 space-y-4">
        {invite && <input type="hidden" name="invite" value={invite} />}
        <FormError message={state?.error} />
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {!invite && (
          <Field label="Business name" htmlFor="orgName" hint="You can change this later.">
            <Input id="orgName" name="orgName" autoComplete="organization" defaultValue={state?.values?.orgName} />
          </Field>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href={invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login"} className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
