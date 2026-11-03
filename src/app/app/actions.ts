"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireActionCtx } from "@/lib/session";
import {
  addPhoto,
  adjustQuantity,
  createFolder,
  createItem,
  deleteFolder,
  deleteItem,
  deletePhoto,
  getItem,
  InventoryError,
  moveItems,
  renameFolder,
  restoreItem,
  updateItem,
  type ItemInput,
} from "@/server/inventory";
import { ALLOWED_IMAGE_TYPES, getStorage, MAX_PHOTO_BYTES, sniffImageType } from "@/server/storage";

export type ActionState = { error?: string; ok?: boolean; message?: string } | null;

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
function folderIdFrom(fd: FormData, key = "folderId") {
  const v = str(fd, key);
  return v ? v : null;
}
function refreshApp() {
  revalidatePath("/app", "layout");
}
function asError(e: unknown): ActionState {
  if (e instanceof InventoryError) return { error: e.message };
  throw e;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  let id: string;
  try {
    id = (await createFolder(db, ctx, { name: str(fd, "name"), parentId: folderIdFrom(fd, "parentId") })).id;
  } catch (e) {
    return asError(e);
  }
  refreshApp();
  redirect(`/app/folders/${id}`);
}

export async function renameFolderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  try {
    await renameFolder(db, ctx, str(fd, "folderId"), str(fd, "name"));
  } catch (e) {
    return asError(e);
  }
  refreshApp();
  return { ok: true };
}

export async function deleteFolderAction(fd: FormData) {
  const { ctx } = await requireActionCtx();
  const parentId = await deleteFolder(db, ctx, str(fd, "folderId"));
  refreshApp();
  redirect(parentId ? `/app/folders/${parentId}` : "/app");
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function itemInputFrom(fd: FormData): ItemInput {
  const keys = fd.getAll("cfKey").map(String);
  const vals = fd.getAll("cfValue").map(String);
  const customFields: Record<string, string> = {};
  keys.forEach((k, i) => {
    if (k.trim()) customFields[k] = vals[i] ?? "";
  });
  return {
    name: str(fd, "name"),
    folderId: folderIdFrom(fd),
    quantity: str(fd, "quantity"),
    unit: str(fd, "unit"),
    minQuantity: str(fd, "minQuantity"),
    price: str(fd, "price"),
    sku: str(fd, "sku"),
    barcode: str(fd, "barcode"),
    notes: str(fd, "notes"),
    tags: str(fd, "tags").split(","),
    customFields,
  };
}

export async function saveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  const itemId = str(fd, "itemId");
  let id: string;
  try {
    const input = itemInputFrom(fd);
    id = itemId ? (await updateItem(db, ctx, itemId, input)).id : (await createItem(db, ctx, input)).id;
  } catch (e) {
    return asError(e);
  }
  refreshApp();
  redirect(`/app/items/${id}${itemId ? "" : "?created=1"}`);
}

export async function adjustQuantityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  const mode = str(fd, "mode");
  if (mode !== "add" && mode !== "remove" && mode !== "set") return { error: "Choose add, remove or set." };
  try {
    const q = await adjustQuantity(db, ctx, str(fd, "itemId"), {
      mode,
      amount: str(fd, "amount"),
      note: str(fd, "note"),
    });
    refreshApp();
    return { ok: true, message: `Quantity is now ${Number(q)}` };
  } catch (e) {
    return asError(e);
  }
}

export async function moveItemsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  const ids = fd.getAll("itemIds").map(String).filter(Boolean);
  if (!ids.length) return { error: "Select at least one item." };
  try {
    const n = await moveItems(db, ctx, ids, folderIdFrom(fd, "targetFolderId"));
    refreshApp();
    return { ok: true, message: `Moved ${n} item${n === 1 ? "" : "s"}.` };
  } catch (e) {
    return asError(e);
  }
}

export async function deleteItemAction(fd: FormData) {
  const { ctx } = await requireActionCtx();
  const id = str(fd, "itemId");
  const item = await getItem(db, ctx, id);
  await deleteItem(db, ctx, id);
  refreshApp();
  redirect(item?.folderId ? `/app/folders/${item.folderId}?deleted=1` : "/app?deleted=1");
}

export async function restoreItemAction(fd: FormData) {
  const { ctx } = await requireActionCtx();
  await restoreItem(db, ctx, str(fd, "itemId"));
  refreshApp();
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function uploadPhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx } = await requireActionCtx();
  const itemId = str(fd, "itemId");
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large (max 8 MB)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) return { error: "Use a JPEG, PNG or WebP image." };

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const key = `${ctx.orgId}/${crypto.randomUUID()}.${ext}`;
  try {
    // Check permissions and limits before storing the file.
    const item = await getItem(db, ctx, itemId);
    if (!item) return { error: "Item not found." };
    await getStorage().put(key, buf, type);
    try {
      await addPhoto(db, ctx, itemId, { storageKey: key, contentType: type, size: buf.length });
    } catch (e) {
      await getStorage().delete(key);
      throw e;
    }
  } catch (e) {
    return asError(e);
  }
  refreshApp();
  return { ok: true };
}

export async function deletePhotoAction(fd: FormData) {
  const { ctx } = await requireActionCtx();
  const row = await deletePhoto(db, ctx, str(fd, "photoId"));
  if (row) await getStorage().delete(row.storageKey);
  refreshApp();
}
