import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirects";
import { pageFrom } from "@/lib/paging";
import { buildRows, guessMapping } from "@/lib/csv-import";
import { db, makeWorkspace } from "./helpers";
import { countItems, createItem, listItems } from "@/server/inventory";
import { importRows } from "@/server/import-export";

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/app/items/1")).toBe("/app/items/1");
    expect(safeNext("https://evil.example")).toBe("/app");
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext("/\\evil.example")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });
});

describe("pageFrom", () => {
  it("parses page numbers safely", () => {
    expect(pageFrom("3")).toBe(3);
    expect(pageFrom(["2"])).toBe(2);
    expect(pageFrom("0")).toBe(1);
    expect(pageFrom("-4")).toBe(1);
    expect(pageFrom("abc")).toBe(1);
    expect(pageFrom(undefined)).toBe(1);
  });
});

describe("batched import", () => {
  it("keeps correct line numbers and imports every batch", async () => {
    const headers = ["Name", "Folder", "Qty"];
    const data = Array.from({ length: 1000 }, (_, i) => [i === 650 ? "" : `Item ${i}`, "Shelf A", String(i)]);
    const ctx = await makeWorkspace();
    let imported = 0;
    const errors: number[] = [];
    for (let offset = 0; offset < data.length; offset += 400) {
      const built = buildRows(headers, data.slice(offset, offset + 400), guessMapping(headers), offset);
      errors.push(...built.errors.map((e) => e.line));
      imported += (await importRows(db, ctx, built.rows)).items;
    }
    expect(imported).toBe(999);
    expect(errors).toEqual([652]); // row index 650 + header + 1-based
    // All batches landed in the same folder, not one folder per batch.
    const all = await listItems(db, ctx, { search: "Item", limit: 2000 });
    expect(new Set(all.map((i) => i.folderId)).size).toBe(1);
  });
});

describe("paging", () => {
  it("counts and pages through a folder without gaps or repeats", async () => {
    const ctx = await makeWorkspace();
    for (let i = 0; i < 25; i++) await createItem(db, ctx, { name: `Widget ${String(i).padStart(2, "0")}`, folderId: null });
    expect(await countItems(db, ctx, { folderId: null })).toBe(25);
    const p1 = await listItems(db, ctx, { folderId: null, limit: 10, offset: 0 });
    const p2 = await listItems(db, ctx, { folderId: null, limit: 10, offset: 10 });
    const p3 = await listItems(db, ctx, { folderId: null, limit: 10, offset: 20 });
    const ids = [...p1, ...p2, ...p3].map((i) => i.id);
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
  });
});
