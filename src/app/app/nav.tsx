"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { IconBell, IconBox, IconClock, IconMenu, IconScan } from "@/components/icons";

const links = [
  { href: "/app", label: "Items", icon: IconBox, match: (p: string) => p === "/app" || p.startsWith("/app/folders") || p.startsWith("/app/items") },
  { href: "/app/scan", label: "Scan", icon: IconScan, match: (p: string) => p.startsWith("/app/scan") },
  { href: "/app/low-stock", label: "Low stock", icon: IconBell, match: (p: string) => p.startsWith("/app/low-stock") },
  { href: "/app/activity", label: "Activity", icon: IconClock, match: (p: string) => p.startsWith("/app/activity") },
  { href: "/app/more", label: "More", icon: IconMenu, match: (p: string) => ["/app/more", "/app/settings", "/app/import", "/app/trash", "/app/labels"].some((x) => p.startsWith(x)) },
];

export function SideNav({ lowStock }: { lowStock: number }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {links.map(({ href, label, icon: Icon, match }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            match(pathname) ? "bg-brand-50 text-brand-800" : "text-neutral-700 hover:bg-neutral-100",
          )}
        >
          <Icon />
          <span className="flex-1">{label}</span>
          {label === "Low stock" && lowStock > 0 && (
            <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800">{lowStock}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ lowStock }: { lowStock: number }) {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-brand-700" : "text-neutral-500",
              )}
            >
              {label === "Scan" ? (
                <span className={cx("grid h-9 w-9 place-items-center rounded-full", active ? "bg-brand-700 text-white" : "bg-brand-600 text-white")}>
                  <Icon width={20} height={20} />
                </span>
              ) : (
                <span className="relative grid h-9 place-items-center">
                  <Icon width={22} height={22} />
                  {label === "Low stock" && lowStock > 0 && (
                    <span className="absolute -right-2 top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 text-white">
                      {lowStock > 99 ? "99+" : lowStock}
                    </span>
                  )}
                </span>
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
