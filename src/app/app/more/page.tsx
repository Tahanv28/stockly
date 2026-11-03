import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { IconChevronRight, IconDownload, IconPrinter, IconTrash, IconUpload, IconUsers } from "@/components/icons";
import { logoutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "More" };

const links = [
  { href: "/app/import", label: "Import from Sortly / CSV", desc: "Bring your inventory over in minutes", icon: IconUpload },
  { href: "/api/export", label: "Export to CSV", desc: "Download everything — your data is always yours", icon: IconDownload, download: true },
  { href: "/app/labels", label: "Print QR labels", desc: "Label shelves, bins and tools", icon: IconPrinter },
  { href: "/app/trash", label: "Trash", desc: "Restore deleted items", icon: IconTrash },
  { href: "/app/settings", label: "Workspace & team", desc: "Invite teammates, rename workspace", icon: IconUsers },
];

export default async function MorePage() {
  const session = await requireSession();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="More" subtitle={session.org.name} />
      <Card className="divide-y divide-neutral-100">
        {links.map(({ href, label, desc, icon: Icon, download }) => {
          const inner = (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-sm text-neutral-500">{desc}</div>
              </div>
              <IconChevronRight className="text-neutral-400" />
            </div>
          );
          return download ? (
            <a key={href} href={href} className="block hover:bg-neutral-50">
              {inner}
            </a>
          ) : (
            <Link key={href} href={href} className="block hover:bg-neutral-50">
              {inner}
            </Link>
          );
        })}
      </Card>
      <form action={logoutAction} className="mt-4">
        <button type="submit" className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-red-700 hover:bg-red-50">
          Log out
        </button>
      </form>
    </div>
  );
}
