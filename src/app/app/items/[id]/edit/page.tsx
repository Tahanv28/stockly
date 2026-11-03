import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getItem, listAllFolderPaths } from "@/server/inventory";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit item" };

const num = (v: string | null) => (v === null ? "" : String(Number(v)));

export default async function EditItemPage({ params }: PageProps<"/app/items/[id]/edit">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const { id } = await params;
  const [item, folders] = await Promise.all([getItem(db, ctx, id), listAllFolderPaths(db, ctx)]);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit ${item.name}`} />
      <ItemForm
        folders={folders}
        cancelHref={`/app/items/${item.id}`}
        initial={{
          id: item.id,
          name: item.name,
          folderId: item.folderId,
          quantity: num(item.quantity),
          unit: item.unit ?? "",
          minQuantity: num(item.minQuantity),
          price: item.price === null ? "" : Number(item.price).toFixed(2),
          sku: item.sku ?? "",
          barcode: item.barcode ?? "",
          notes: item.notes ?? "",
          tags: item.tags.join(", "),
          customFields: Object.entries(item.customFields).map(([key, value]) => ({ key, value })),
        }}
      />
    </div>
  );
}
