import type { Metadata } from "next";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getFolder, listAllFolderPaths } from "@/server/inventory";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage({ searchParams }: PageProps<"/app/items/new">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const sp = await searchParams;
  const folderParam = typeof sp.folder === "string" ? sp.folder : null;
  const barcode = typeof sp.barcode === "string" ? sp.barcode : "";
  const folder = folderParam ? await getFolder(db, ctx, folderParam) : null;
  const folders = await listAllFolderPaths(db, ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add item" />
      <ItemForm
        folders={folders}
        cancelHref={folder ? `/app/folders/${folder.id}` : "/app"}
        initial={{
          name: "",
          folderId: folder?.id ?? null,
          quantity: "",
          unit: "",
          minQuantity: "",
          price: "",
          sku: "",
          barcode,
          notes: "",
          tags: "",
          customFields: [],
        }}
      />
    </div>
  );
}
