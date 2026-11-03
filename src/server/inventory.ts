import { and, asc, desc, eq, inArray, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { activity, folders, itemPhotos, items, users, type ActivityType } from "@/db/schema";
import type { Ctx } from "./auth";
import { parseDecimal } from "@/lib/numbers";

export class InventoryError extends Error {}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Executor = DB | Tx;

async function log(
  ex: Executor,
  ctx: Ctx,
  entry: {
    type: ActivityType;
    itemId?: string | null;
    folderId?: string | null;
    itemName?: string | null;
    quantityBefore?: string | null;
    quantityAfter?: string | null;
    note?: string | null;
    data?: Record<string, unknown>;
  },
) {
  await ex.insert(activity).values({ orgId: ctx.orgId, userId: ctx.userId, ...entry });
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function getFolder(db: DB, ctx: Ctx, folderId: string) {
  return (
    (await db.query.folders.findFirst({
      where: and(eq(folders.id, folderId), eq(folders.orgId, ctx.orgId)),
    })) ?? null
  );
}

async function assertFolder(ex: Executor, ctx: Ctx, folderId: string | null) {
  if (!folderId) return;
  const [f] = await ex
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.orgId, ctx.orgId)));
  if (!f) throw new InventoryError("Folder not found.");
}

/** Ancestors from the root down to (and including) the folder. */
export async function getFolderPath(db: DB, ctx: Ctx, folderId: string | null) {
  if (!folderId) return [];
  const result = await db.execute<{ id: string; name: string; depth: number }>(sql`
    with recursive path as (
      select id, name, parent_id, 0 as depth from folders
      where id = ${folderId} and org_id = ${ctx.orgId}
      union all
      select f.id, f.name, f.parent_id, p.depth + 1 from folders f
      join path p on f.id = p.parent_id
      where f.org_id = ${ctx.orgId} and p.depth < 50
    )
    select id, name, depth from path order by depth desc
  `);
  return result.rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function listFolders(db: DB, ctx: Ctx, parentId: string | null) {
  const rows = await db.execute<{
    id: string;
    name: string;
    item_count: number;
    folder_count: number;
    total_quantity: string | null;
  }>(sql`
    select f.id, f.name,
      (select count(*)::int from items i
        where i.folder_id = f.id and i.org_id = ${ctx.orgId} and i.deleted_at is null) as item_count,
      (select count(*)::int from folders c
        where c.parent_id = f.id and c.org_id = ${ctx.orgId}) as folder_count,
      (select sum(i.quantity) from items i
        where i.folder_id = f.id and i.org_id = ${ctx.orgId} and i.deleted_at is null) as total_quantity
    from folders f
    where f.org_id = ${ctx.orgId}
      and ${parentId ? sql`f.parent_id = ${parentId}` : sql`f.parent_id is null`}
    order by lower(f.name)
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    itemCount: Number(r.item_count),
    folderCount: Number(r.folder_count),
    totalQuantity: r.total_quantity ?? "0",
  }));
}

/** Every folder with its full path, for "move to" pickers. */
export async function listAllFolderPaths(db: DB, ctx: Ctx) {
  const all = await db
    .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.orgId, ctx.orgId));
  const byId = new Map(all.map((f) => [f.id, f]));
  const pathOf = (id: string) => {
    const names: string[] = [];
    let cur = byId.get(id);
    let guard = 0;
    while (cur && guard++ < 50) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.join(" / ");
  };
  return all
    .map((f) => ({ id: f.id, path: pathOf(f.id) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function createFolder(db: DB, ctx: Ctx, input: { name: string; parentId: string | null }) {
  const name = input.name.trim();
  if (!name) throw new InventoryError("Folder name is required.");
  await assertFolder(db, ctx, input.parentId);
  return db.transaction(async (tx) => {
    const [folder] = await tx
      .insert(folders)
      .values({ orgId: ctx.orgId, parentId: input.parentId, name })
      .returning();
    await log(tx, ctx, { type: "folder.created", folderId: folder.id, data: { name } });
    return folder;
  });
}

export async function renameFolder(db: DB, ctx: Ctx, folderId: string, nameInput: string) {
  const name = nameInput.trim();
  if (!name) throw new InventoryError("Folder name is required.");
  const folder = await getFolder(db, ctx, folderId);
  if (!folder) throw new InventoryError("Folder not found.");
  await db.transaction(async (tx) => {
    await tx
      .update(folders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(folders.id, folderId), eq(folders.orgId, ctx.orgId)));
    await log(tx, ctx, { type: "folder.renamed", folderId, data: { from: folder.name, to: name } });
  });
}

/** Deletes a folder. Its items and subfolders move up to the parent, so nothing is lost. */
export async function deleteFolder(db: DB, ctx: Ctx, folderId: string) {
  const folder = await getFolder(db, ctx, folderId);
  if (!folder) throw new InventoryError("Folder not found.");
  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({ folderId: folder.parentId, updatedAt: new Date() })
      .where(and(eq(items.folderId, folderId), eq(items.orgId, ctx.orgId)));
    await tx
      .update(folders)
      .set({ parentId: folder.parentId, updatedAt: new Date() })
      .where(and(eq(folders.parentId, folderId), eq(folders.orgId, ctx.orgId)));
    await tx.delete(folders).where(and(eq(folders.id, folderId), eq(folders.orgId, ctx.orgId)));
    await log(tx, ctx, { type: "folder.deleted", folderId, data: { name: folder.name } });
  });
  return folder.parentId;
}

/** Finds a folder by path segments, creating any that are missing. Used by imports. */
export async function ensureFolderPath(ex: Executor, ctx: Ctx, segments: string[], cache?: Map<string, string>) {
  let parentId: string | null = null;
  let key = "";
  for (const raw of segments) {
    const name = raw.trim();
    if (!name) continue;
    key += `/${name.toLowerCase()}`;
    const cached = cache?.get(key);
    if (cached) {
      parentId = cached;
      continue;
    }
    const parentCond: SQL = parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId);
    const [existing] = await ex
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.orgId, ctx.orgId), parentCond, sql`lower(${folders.name}) = ${name.toLowerCase()}`))
      .limit(1);
    let id: string;
    if (existing) id = existing.id;
    else {
      const [created] = await ex
        .insert(folders)
        .values({ orgId: ctx.orgId, parentId, name })
        .returning({ id: folders.id });
      id = created.id;
    }
    cache?.set(key, id);
    parentId = id;
  }
  return parentId;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type ItemInput = {
  name: string;
  folderId: string | null;
  quantity?: string | null;
  unit?: string | null;
  minQuantity?: string | null;
  price?: string | null;
  sku?: string | null;
  barcode?: string | null;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, string>;
};

function cleanText(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : null;
}

function normalizeItemInput(input: ItemInput) {
  const name = input.name.trim();
  if (!name) throw new InventoryError("Item name is required.");
  if (name.length > 200) throw new InventoryError("Item name is too long.");
  let quantity: string | null;
  let minQuantity: string | null;
  let price: string | null;
  try {
    quantity = parseDecimal(input.quantity);
    minQuantity = parseDecimal(input.minQuantity);
    price = parseDecimal(input.price, { maxScale: 2 });
  } catch (e) {
    throw new InventoryError((e as Error).message);
  }
  if (quantity !== null && Number(quantity) < 0) throw new InventoryError("Quantity can't be negative.");
  if (minQuantity !== null && Number(minQuantity) < 0) throw new InventoryError("Minimum can't be negative.");
  const tags = Array.from(
    new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean).map((t) => t.slice(0, 50))),
  ).slice(0, 30);
  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.customFields ?? {})) {
    const key = k.trim().slice(0, 100);
    const val = String(v ?? "").trim().slice(0, 1000);
    if (key && val) customFields[key] = val;
  }
  return {
    name,
    folderId: input.folderId,
    quantity: quantity ?? "0",
    unit: cleanText(input.unit),
    minQuantity,
    price,
    sku: cleanText(input.sku),
    barcode: cleanText(input.barcode),
    notes: cleanText(input.notes),
    tags,
    customFields,
  };
}

export async function createItem(db: DB, ctx: Ctx, input: ItemInput) {
  const values = normalizeItemInput(input);
  await assertFolder(db, ctx, values.folderId);
  return db.transaction(async (tx) => {
    const [item] = await tx.insert(items).values({ orgId: ctx.orgId, ...values }).returning();
    await log(tx, ctx, {
      type: "item.created",
      itemId: item.id,
      folderId: item.folderId,
      itemName: item.name,
      quantityAfter: item.quantity,
    });
    return item;
  });
}

const TRACKED_FIELDS = ["name", "sku", "barcode", "unit", "minQuantity", "price", "notes"] as const;

export async function updateItem(db: DB, ctx: Ctx, itemId: string, input: ItemInput) {
  const values = normalizeItemInput(input);
  await assertFolder(db, ctx, values.folderId);
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId), isNull(items.deletedAt)))
      .for("update");
    if (!before) throw new InventoryError("Item not found.");

    const [after] = await tx
      .update(items)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId)))
      .returning();

    const changed: string[] = [];
    for (const f of TRACKED_FIELDS) {
      const a = before[f] === null ? null : String(before[f]);
      const b = after[f] === null ? null : String(after[f]);
      if (f === "minQuantity" || f === "price") {
        if ((a === null) !== (b === null) || (a !== null && Number(a) !== Number(b))) changed.push(f);
      } else if (a !== b) changed.push(f);
    }
    if (before.tags.join("|") !== after.tags.join("|")) changed.push("tags");
    if (JSON.stringify(before.customFields) !== JSON.stringify(after.customFields)) changed.push("customFields");

    if (changed.length) {
      await log(tx, ctx, { type: "item.updated", itemId, itemName: after.name, data: { fields: changed } });
    }
    if (Number(before.quantity) !== Number(after.quantity)) {
      await log(tx, ctx, {
        type: "item.quantity",
        itemId,
        itemName: after.name,
        quantityBefore: before.quantity,
        quantityAfter: after.quantity,
        note: "Edited",
      });
    }
    if (before.folderId !== after.folderId) {
      await log(tx, ctx, {
        type: "item.moved",
        itemId,
        itemName: after.name,
        folderId: after.folderId,
        data: { from: before.folderId, to: after.folderId },
      });
    }
    return after;
  });
}

export async function adjustQuantity(
  db: DB,
  ctx: Ctx,
  itemId: string,
  input: { mode: "add" | "remove" | "set"; amount: string; note?: string | null },
) {
  let amount: string | null;
  try {
    amount = parseDecimal(input.amount);
  } catch (e) {
    throw new InventoryError((e as Error).message);
  }
  if (amount === null) throw new InventoryError("Enter an amount.");
  if (Number(amount) < 0) throw new InventoryError("Amount can't be negative.");
  if (input.mode !== "set" && Number(amount) === 0) throw new InventoryError("Amount must be more than 0.");

  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ quantity: items.quantity, name: items.name })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId), isNull(items.deletedAt)))
      .for("update");
    if (!before) throw new InventoryError("Item not found.");

    const next =
      input.mode === "set"
        ? sql`${amount}::numeric`
        : input.mode === "add"
          ? sql`${items.quantity} + ${amount}::numeric`
          : sql`${items.quantity} - ${amount}::numeric`;

    if (input.mode === "remove" && Number(before.quantity) - Number(amount) < -1e-9) {
      throw new InventoryError(`Only ${Number(before.quantity)} in stock.`);
    }

    const [after] = await tx
      .update(items)
      .set({ quantity: next, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId)))
      .returning({ quantity: items.quantity });

    await log(tx, ctx, {
      type: "item.quantity",
      itemId,
      itemName: before.name,
      quantityBefore: before.quantity,
      quantityAfter: after.quantity,
      note: cleanText(input.note),
    });
    return after.quantity;
  });
}

export async function moveItems(db: DB, ctx: Ctx, itemIds: string[], folderId: string | null) {
  if (!itemIds.length) return 0;
  await assertFolder(db, ctx, folderId);
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(items)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(items.orgId, ctx.orgId), inArray(items.id, itemIds), isNull(items.deletedAt)))
      .returning({ id: items.id, name: items.name });
    for (const m of moved) {
      await log(tx, ctx, { type: "item.moved", itemId: m.id, itemName: m.name, folderId, data: { to: folderId } });
    }
    return moved.length;
  });
}

export async function deleteItem(db: DB, ctx: Ctx, itemId: string) {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .update(items)
      .set({ deletedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId), isNull(items.deletedAt)))
      .returning({ id: items.id, name: items.name, folderId: items.folderId });
    if (!item) throw new InventoryError("Item not found.");
    await log(tx, ctx, { type: "item.deleted", itemId, itemName: item.name, folderId: item.folderId });
  });
}

export async function restoreItem(db: DB, ctx: Ctx, itemId: string) {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .update(items)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.orgId, ctx.orgId), isNotNull(items.deletedAt)))
      .returning({ id: items.id, name: items.name, folderId: items.folderId });
    if (!item) throw new InventoryError("Item not found in trash.");
    // If its folder was deleted meanwhile, put it at the top level.
    if (item.folderId) {
      const [f] = await tx
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, item.folderId), eq(folders.orgId, ctx.orgId)));
      if (!f) await tx.update(items).set({ folderId: null }).where(eq(items.id, itemId));
    }
    await log(tx, ctx, { type: "item.restored", itemId, itemName: item.name });
  });
}

export async function getItem(db: DB, ctx: Ctx, itemId: string) {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.orgId, ctx.orgId), isNull(items.deletedAt)),
  });
  if (!item) return null;
  const photos = await db
    .select()
    .from(itemPhotos)
    .where(and(eq(itemPhotos.itemId, itemId), eq(itemPhotos.orgId, ctx.orgId)))
    .orderBy(asc(itemPhotos.position), asc(itemPhotos.createdAt));
  return { ...item, photos };
}

export type ItemListRow = {
  id: string;
  name: string;
  quantity: string;
  unit: string | null;
  minQuantity: string | null;
  price: string | null;
  sku: string | null;
  barcode: string | null;
  tags: string[];
  folderId: string | null;
  photoId: string | null;
};

export async function listItems(
  db: DB,
  ctx: Ctx,
  opts: { folderId?: string | null; search?: string; lowStock?: boolean; trash?: boolean; limit?: number },
): Promise<ItemListRow[]> {
  const conds: SQL[] = [eq(items.orgId, ctx.orgId)];
  conds.push(opts.trash ? isNotNull(items.deletedAt) : isNull(items.deletedAt));
  const q = opts.search?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conds.push(sql`(
      ${items.name} ilike ${pattern} or ${items.sku} ilike ${pattern} or ${items.barcode} ilike ${pattern}
      or ${items.notes} ilike ${pattern} or array_to_string(${items.tags}, ' ') ilike ${pattern}
    )`);
  } else if (opts.folderId !== undefined && !opts.lowStock && !opts.trash) {
    conds.push(opts.folderId ? eq(items.folderId, opts.folderId) : isNull(items.folderId));
  }
  if (opts.lowStock) {
    conds.push(sql`${items.minQuantity} is not null and ${items.quantity} <= ${items.minQuantity}`);
  }
  return db
    .select({
      id: items.id,
      name: items.name,
      quantity: items.quantity,
      unit: items.unit,
      minQuantity: items.minQuantity,
      price: items.price,
      sku: items.sku,
      barcode: items.barcode,
      tags: items.tags,
      folderId: items.folderId,
      photoId: sql<string | null>`(
        select p.id from item_photos p where p.item_id = ${items.id}
        order by p.position, p.created_at limit 1
      )`,
    })
    .from(items)
    .where(and(...conds))
    .orderBy(opts.trash ? desc(items.deletedAt) : sql`lower(${items.name})`)
    .limit(opts.limit ?? 500);
}

/** Looks up an item by scanned/typed code: barcode, SKU, or Stockly item id. */
export async function findItemsByCode(db: DB, ctx: Ctx, codeInput: string) {
  const code = codeInput.trim();
  if (!code) return [];
  return db
    .select({ id: items.id, name: items.name, quantity: items.quantity, unit: items.unit })
    .from(items)
    .where(
      and(
        eq(items.orgId, ctx.orgId),
        isNull(items.deletedAt),
        sql`(${items.barcode} = ${code} or ${items.sku} = ${code} or ${items.id} = ${code})`,
      ),
    )
    .limit(20);
}

export async function getStats(db: DB, ctx: Ctx) {
  const result = await db.execute<{
    item_count: number;
    total_quantity: string | null;
    total_value: string | null;
    low_stock: number;
    folder_count: number;
  }>(sql`
    select
      count(*)::int as item_count,
      sum(quantity) as total_quantity,
      sum(quantity * price) as total_value,
      count(*) filter (where min_quantity is not null and quantity <= min_quantity)::int as low_stock,
      (select count(*)::int from folders where org_id = ${ctx.orgId}) as folder_count
    from items where org_id = ${ctx.orgId} and deleted_at is null
  `);
  const r = result.rows[0];
  return {
    itemCount: Number(r?.item_count ?? 0),
    totalQuantity: r?.total_quantity ?? "0",
    totalValue: r?.total_value ?? "0",
    lowStock: Number(r?.low_stock ?? 0),
    folderCount: Number(r?.folder_count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function addPhoto(
  db: DB,
  ctx: Ctx,
  itemId: string,
  photo: { storageKey: string; contentType: string; size: number },
) {
  const item = await getItem(db, ctx, itemId);
  if (!item) throw new InventoryError("Item not found.");
  if (item.photos.length >= 8) throw new InventoryError("An item can have up to 8 photos.");
  const [row] = await db
    .insert(itemPhotos)
    .values({ orgId: ctx.orgId, itemId, position: item.photos.length, ...photo })
    .returning();
  return row;
}

export async function getPhoto(db: DB, ctx: Ctx, photoId: string) {
  return (
    (await db.query.itemPhotos.findFirst({
      where: and(eq(itemPhotos.id, photoId), eq(itemPhotos.orgId, ctx.orgId)),
    })) ?? null
  );
}

export async function deletePhoto(db: DB, ctx: Ctx, photoId: string) {
  const [row] = await db
    .delete(itemPhotos)
    .where(and(eq(itemPhotos.id, photoId), eq(itemPhotos.orgId, ctx.orgId)))
    .returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function listActivity(db: DB, ctx: Ctx, opts: { itemId?: string; limit?: number } = {}) {
  const conds: SQL[] = [eq(activity.orgId, ctx.orgId)];
  if (opts.itemId) conds.push(eq(activity.itemId, opts.itemId));
  return db
    .select({
      id: activity.id,
      type: activity.type,
      itemId: activity.itemId,
      itemName: activity.itemName,
      quantityBefore: activity.quantityBefore,
      quantityAfter: activity.quantityAfter,
      note: activity.note,
      data: activity.data,
      createdAt: activity.createdAt,
      userName: users.name,
    })
    .from(activity)
    .leftJoin(users, eq(users.id, activity.userId))
    .where(and(...conds))
    .orderBy(desc(activity.createdAt))
    .limit(opts.limit ?? 100);
}
