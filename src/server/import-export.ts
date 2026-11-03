import Papa from "papaparse";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { activity, folders, items } from "@/db/schema";
import type { Ctx } from "./auth";
import { ensureFolderPath, InventoryError } from "./inventory";
import type { ImportRow } from "@/lib/csv-import";

export async function importRows(db: DB, ctx: Ctx, rows: ImportRow[]) {
  if (!rows.length) throw new InventoryError("Nothing to import.");
  return db.transaction(async (tx) => {
    const folderCache = new Map<string, string>();
    const values: (typeof items.$inferInsert)[] = [];
    for (const r of rows) {
      const folderId = r.folderPath.length ? await ensureFolderPath(tx, ctx, r.folderPath, folderCache) : null;
      values.push({
        orgId: ctx.orgId,
        folderId,
        name: r.name,
        quantity: r.quantity ?? "0",
        unit: r.unit,
        minQuantity: r.minQuantity,
        price: r.price,
        sku: r.sku,
        barcode: r.barcode,
        notes: r.notes,
        tags: Array.from(new Set(r.tags)).slice(0, 30),
        customFields: r.customFields,
      });
    }
    for (let i = 0; i < values.length; i += 500) {
      await tx.insert(items).values(values.slice(i, i + 500));
    }
    await tx.insert(activity).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      type: "item.imported",
      data: { count: values.length, folders: folderCache.size },
    });
    return { items: values.length, folders: folderCache.size };
  });
}

/** Full CSV export of all (non-deleted) items. Re-importable into Stockly. */
export async function exportCsv(db: DB, ctx: Ctx) {
  const [allFolders, allItems] = await Promise.all([
    db.select().from(folders).where(eq(folders.orgId, ctx.orgId)),
    db
      .select()
      .from(items)
      .where(and(eq(items.orgId, ctx.orgId), isNull(items.deletedAt)))
      .orderBy(items.name),
  ]);
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const pathOf = (id: string | null) => {
    const names: string[] = [];
    let cur = id ? byId.get(id) : undefined;
    let guard = 0;
    while (cur && guard++ < 50) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.join(" / ");
  };
  const customKeys = Array.from(new Set(allItems.flatMap((i) => Object.keys(i.customFields)))).sort();
  const fields = [
    "Name", "Folder", "Quantity", "Unit", "Low-stock level", "Price", "SKU", "Barcode", "Tags", "Notes",
    ...customKeys, "Stockly ID",
  ];
  const data = allItems.map((i) => [
    i.name,
    pathOf(i.folderId),
    String(Number(i.quantity)),
    i.unit ?? "",
    i.minQuantity === null ? "" : String(Number(i.minQuantity)),
    i.price === null ? "" : Number(i.price).toFixed(2),
    i.sku ?? "",
    i.barcode ?? "",
    i.tags.join(", "),
    i.notes ?? "",
    ...customKeys.map((k) => i.customFields[k] ?? ""),
    i.id,
  ]);
  // Protect against CSV formula injection when opened in Excel/Sheets.
  const safe = data.map((row) => row.map((c) => (/^[=+\-@\t\r]/.test(c) && !/^-?\d/.test(c) ? `'${c}` : c)));
  return Papa.unparse({ fields, data: safe });
}
