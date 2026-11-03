import type { Metadata } from "next";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { listItems } from "@/server/inventory";
import { ItemRow } from "@/components/item-list";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { IconTrash } from "@/components/icons";
import { restoreItemAction } from "../actions";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const session = await requireSession();
  const items = await listItems(db, toCtx(session), { trash: true });
  return (
    <div>
      <PageHeader title="Trash" subtitle="Deleted items stay here so nothing is lost by accident." />
      {items.length === 0 ? (
        <EmptyState icon={<IconTrash width={32} height={32} />} title="Trash is empty" />
      ) : (
        <Card className="divide-y divide-neutral-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-center">
              <div className="min-w-0 flex-1">
                <ItemRow item={item} />
              </div>
              <form action={restoreItemAction} className="pr-4">
                <input type="hidden" name="itemId" value={item.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Restore
                </Button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
