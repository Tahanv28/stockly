import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-1 text-neutral-500">This page or item doesn&apos;t exist, or it&apos;s in another workspace.</p>
      <LinkButton href="/app" variant="secondary" className="mt-5">
        Back to items
      </LinkButton>
    </main>
  );
}
