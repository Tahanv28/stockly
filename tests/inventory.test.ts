import { describe, expect, it } from "vitest";
import { db, makeWorkspace } from "./helpers";
import {
  adjustQuantity,
  createFolder,
  createItem,
  deleteFolder,
  deleteItem,
  ensureFolderPath,
  findItemsByCode,
  getFolderPath,
  getItem,
  getStats,
  listActivity,
  listItems,
  moveItems,
  restoreItem,
  updateItem,
  InventoryError,
} from "@/server/inventory";

describe("workspace isolation", () => {
  it("never shows or changes another workspace's data", async () => {
    const a = await makeWorkspace("A");
    const b = await makeWorkspace("B");
    const folderA = await createFolder(db, a, { name: "Warehouse", parentId: null });
    const itemA = await createItem(db, a, { name: "Drill", folderId: folderA.id, quantity: "3", barcode: "123" });

    expect(await getItem(db, b, itemA.id)).toBeNull();
    expect(await listItems(db, b, { search: "Drill" })).toHaveLength(0);
    expect(await findItemsByCode(db, b, "123")).toHaveLength(0);
    await expect(adjustQuantity(db, b, itemA.id, { mode: "add", amount: "1" })).rejects.toThrow(InventoryError);
    await expect(deleteItem(db, b, itemA.id)).rejects.toThrow(InventoryError);
    await expect(
      createItem(db, b, { name: "Sneaky", folderId: folderA.id }),
    ).rejects.toThrow("Folder not found.");
    expect(await moveItems(db, b, [itemA.id], null)).toBe(0);
    expect(await getFolderPath(db, b, folderA.id)).toEqual([]);

    const still = await getItem(db, a, itemA.id);
    expect(still?.quantity).toBe("3.000");
    expect(still?.folderId).toBe(folderA.id);
  });
});

describe("items", () => {
  it("creates, edits, adjusts and logs history", async () => {
    const ctx = await makeWorkspace();
    const item = await createItem(db, ctx, {
      name: "  Cable ties ",
      folderId: null,
      quantity: "1,5",
      minQuantity: "2",
      price: "€3.499",
      tags: ["electrical", "electrical", " "],
    });
    expect(item.name).toBe("Cable ties");
    expect(item.quantity).toBe("1.500");
    expect(item.price).toBe("3.49");
    expect(item.tags).toEqual(["electrical"]);

    expect(await listItems(db, ctx, { lowStock: true })).toHaveLength(1);

    expect(await adjustQuantity(db, ctx, item.id, { mode: "add", amount: "10", note: "Delivery" })).toBe("11.500");
    expect(await adjustQuantity(db, ctx, item.id, { mode: "remove", amount: "0.5" })).toBe("11.000");
    await expect(adjustQuantity(db, ctx, item.id, { mode: "remove", amount: "20" })).rejects.toThrow("Only 11 in stock.");
    expect(await adjustQuantity(db, ctx, item.id, { mode: "set", amount: "4" })).toBe("4.000");
    expect(await listItems(db, ctx, { lowStock: true })).toHaveLength(0);

    await updateItem(db, ctx, item.id, { name: "Cable ties 200mm", folderId: null, quantity: "4", minQuantity: "2" });

    const history = await listActivity(db, ctx, { itemId: item.id });
    const types = history.map((h) => h.type);
    expect(types.filter((t) => t === "item.quantity")).toHaveLength(3);
    expect(types).toContain("item.created");
    expect(types).toContain("item.updated");
    expect(history.find((h) => h.note === "Delivery")?.quantityAfter).toBe("11.500");
  });

  it("rejects invalid input", async () => {
    const ctx = await makeWorkspace();
    await expect(createItem(db, ctx, { name: " ", folderId: null })).rejects.toThrow("Item name is required.");
    await expect(createItem(db, ctx, { name: "X", folderId: null, quantity: "abc" })).rejects.toThrow(InventoryError);
    await expect(createItem(db, ctx, { name: "X", folderId: null, quantity: "-1" })).rejects.toThrow(InventoryError);
  });

  it("finds by barcode, sku or id and supports trash/restore", async () => {
    const ctx = await makeWorkspace();
    const item = await createItem(db, ctx, { name: "Gloves", folderId: null, sku: "GL-1", barcode: "4006381333931" });
    expect((await findItemsByCode(db, ctx, "4006381333931"))[0]?.id).toBe(item.id);
    expect((await findItemsByCode(db, ctx, "GL-1"))[0]?.id).toBe(item.id);
    expect((await findItemsByCode(db, ctx, item.id))[0]?.id).toBe(item.id);

    await deleteItem(db, ctx, item.id);
    expect(await getItem(db, ctx, item.id)).toBeNull();
    expect(await listItems(db, ctx, { trash: true })).toHaveLength(1);
    await restoreItem(db, ctx, item.id);
    expect(await getItem(db, ctx, item.id)).not.toBeNull();
  });

  it("searches across folders and escapes wildcards", async () => {
    const ctx = await makeWorkspace();
    const f = await createFolder(db, ctx, { name: "Van 1", parentId: null });
    await createItem(db, ctx, { name: "100% cotton rags", folderId: f.id });
    await createItem(db, ctx, { name: "Hammer", folderId: null, tags: ["tools"] });
    expect(await listItems(db, ctx, { search: "100%" })).toHaveLength(1);
    expect(await listItems(db, ctx, { search: "%" })).toHaveLength(1);
    expect(await listItems(db, ctx, { search: "tools" })).toHaveLength(1);
    expect(await listItems(db, ctx, { folderId: null })).toHaveLength(1);
  });
});

describe("folders", () => {
  it("builds paths and moves contents up when a folder is deleted", async () => {
    const ctx = await makeWorkspace();
    const site = await createFolder(db, ctx, { name: "Site", parentId: null });
    const shed = await createFolder(db, ctx, { name: "Shed", parentId: site.id });
    const shelf = await createFolder(db, ctx, { name: "Shelf", parentId: shed.id });
    const item = await createItem(db, ctx, { name: "Saw", folderId: shed.id });

    expect((await getFolderPath(db, ctx, shelf.id)).map((p) => p.name)).toEqual(["Site", "Shed", "Shelf"]);

    await deleteFolder(db, ctx, shed.id);
    expect((await getItem(db, ctx, item.id))?.folderId).toBe(site.id);
    expect((await getFolderPath(db, ctx, shelf.id)).map((p) => p.name)).toEqual(["Site", "Shelf"]);
  });

  it("ensureFolderPath reuses existing folders case-insensitively", async () => {
    const ctx = await makeWorkspace();
    const id1 = await ensureFolderPath(db, ctx, ["Warehouse", "Aisle 3"]);
    const id2 = await ensureFolderPath(db, ctx, ["warehouse", "AISLE 3"]);
    expect(id1).toBe(id2);
    const stats = await getStats(db, ctx);
    expect(stats.folderCount).toBe(2);
  });
});
