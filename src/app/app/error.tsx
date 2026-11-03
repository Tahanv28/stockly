"use client";

import { Button, LinkButton } from "@/components/ui";

// Shown instead of a blank crash page if something goes wrong inside the app.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-neutral-500">
        Your data is safe. Try again — if it keeps happening, reload the page.
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <LinkButton href="/app" variant="secondary">
          Back to items
        </LinkButton>
      </div>
    </div>
  );
}
