import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center">
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
