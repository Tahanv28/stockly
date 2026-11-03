import Link from "next/link";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getStats } from "@/server/inventory";
import { Logo } from "@/components/logo";
import { IconSearch } from "@/components/icons";
import { BottomNav, SideNav } from "./nav";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession();
  const stats = await getStats(db, toCtx(session));

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print hidden w-60 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
        <div className="px-5 py-5">
          <Logo href="/app" />
        </div>
        <div className="px-3">
          <SideNav lowStock={stats.lowStock} />
        </div>
        <div className="mt-auto border-t border-neutral-200 px-5 py-4 text-xs text-neutral-500">
          <div className="truncate font-medium text-neutral-800">{session.org.name}</div>
          <div className="truncate">{session.user.email}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo href="/app" />
            <Link href="/app/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-lg text-neutral-700 hover:bg-neutral-100">
              <IconSearch />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">{children}</main>
      </div>

      <BottomNav lowStock={stats.lowStock} />
    </div>
  );
}
