import type { Metadata } from "next";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { listAllFolderPaths, listItems } from "@/server/inventory";
import { ItemList } from "@/components/item-list";
import { EmptyState, PageHeader } from "@/components/ui";
import { IconBell } from "@/components/icons";

export const metadata: Metadata = { title: "Low stock" };

export default async function LowStockPage() {
  const session = await requireSession();
  const ctx = toCtx(session);
  const [items, folders] = await Promise.all([listItems(db, ctx, { lowStock: true }), listAllFolderPaths(db, ctx)]);
  const folderNames = Object.fromEntries(folders.map((f) => [f.id, f.path]));

  return (
    <div>
      <PageHeader
        title="Low stock"
        subtitle="Items at or below their low-stock level. Set the level on each item."
      />
      {items.length ? (
        <ItemList items={items} folders={folders} folderNames={folderNames} />
      ) : (
        <EmptyState
          icon={<IconBell width={32} height={32} />}
          title="Nothing is running low"
          description='Give items a "Low-stock alert at" number and they will show up here when they need reordering.'
        />
      )}
    </div>
  );
}
