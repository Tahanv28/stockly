import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getStats } from "@/server/inventory";
import { FolderView } from "@/components/folder-view";
import { formatMoney, formatQty } from "@/lib/numbers";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Items" };

export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const sp = await searchParams;
  const stats = await getStats(db, ctx);

  return (
    <div>
      {sp.welcome && (
        <Card className="mb-5 border-brand-200 bg-brand-50 p-4">
          <p className="font-medium text-brand-900">Welcome to Stockly, {session.user.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-brand-800">
            Start by adding a folder for each location (like &quot;Warehouse&quot; or &quot;Van 1&quot;), then add items.
            Coming from Sortly?{" "}
            <Link href="/app/import" className="font-medium underline">
              Import your export file
            </Link>
            .
          </p>
        </Card>
      )}
      {sp.deleted && (
        <p className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          Item moved to the trash. <Link href="/app/trash" className="font-medium underline">Undo in Trash</Link>
        </p>
      )}

      {stats.itemCount > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Items" value={stats.itemCount.toLocaleString("en-US")} />
          <Stat label="Total units" value={formatQty(stats.totalQuantity)} />
          <Stat label="Total value" value={formatMoney(stats.totalValue)} />
          <Link href="/app/low-stock">
            <Stat label="Low stock" value={String(stats.lowStock)} warn={stats.lowStock > 0} />
          </Link>
        </div>
      )}

      <FolderView ctx={ctx} folderId={null} />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className={`p-3 ${warn ? "border-amber-200 bg-amber-50" : ""}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-semibold tabular-nums ${warn ? "text-amber-800" : ""}`}>{value}</div>
    </Card>
  );
}
