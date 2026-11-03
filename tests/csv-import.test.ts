import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildRows, guessMapping } from "@/lib/csv-import";
import { db, makeWorkspace } from "./helpers";
import { exportCsv, importRows } from "@/server/import-export";
import { getFolderPath, listItems } from "@/server/inventory";
import { parseDecimal } from "@/lib/numbers";

// Shaped like a Sortly CSV export.
const SORTLY_HEADERS = [
  "Entry Name", "Variant Details", "Sortly ID (SID)", "Unit", "Min Level", "Price", "Value", "Quantity",
  "Notes", "Tags", "Barcode/QR1-Data", "Barcode/QR1-Type", "Main Folder", "Subfolder-level1", "Serial Number",
];

describe("parseDecimal", () => {
  it("handles common formats", () => {
    expect(parseDecimal("12")).toBe("12");
    expect(parseDecimal("1,5")).toBe("1.5");
    expect(parseDecimal("1.200,50", { maxScale: 2 })).toBe("1200.5");
    expect(parseDecimal("1,200.50", { maxScale: 2 })).toBe("1200.5");
    expect(parseDecimal("€ 9.99", { maxScale: 2 })).toBe("9.99");
    expect(parseDecimal("007")).toBe("7");
    expect(parseDecimal("")).toBeNull();
    expect(() => parseDecimal("ten")).toThrow();
  });
});

describe("csv import", () => {
  it("auto-maps a Sortly export", () => {
    const m = guessMapping(SORTLY_HEADERS);
    expect(m).toEqual([
      "name", "ignore", "ignore", "unit", "minQuantity", "price", "ignore", "quantity",
      "notes", "tags", "barcode", "ignore", "folderLevel", "folderLevel", "custom",
    ]);
  });

  it("builds rows, folder paths and custom fields; skips bad rows", () => {
    const data = [
      ["Drill", "", "SAB123", "pcs", "2", "129.90", "259.80", "2", "Blue case", "tools, power", "4006381333931", "EAN13", "Van 1", "Back shelf", "SN-77"],
      ["", "", "", "", "", "", "", "5", "", "", "", "", "", "", ""],
      ["Screws", "", "", "box", "", "", "", "lots", "", "", "", "", "Warehouse", "", ""],
      ["Tape", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ];
    const res = buildRows(SORTLY_HEADERS, data, guessMapping(SORTLY_HEADERS));
    expect(res.rows).toHaveLength(2);
    expect(res.errors.map((e) => e.line)).toEqual([3, 4]);
    const drill = res.rows[0];
    expect(drill).toMatchObject({
      name: "Drill",
      quantity: "2",
      minQuantity: "2",
      price: "129.9",
      barcode: "4006381333931",
      tags: ["tools", "power"],
      folderPath: ["Van 1", "Back shelf"],
      customFields: { "Serial Number": "SN-77" },
    });
    expect(res.rows[1].quantity).toBeNull();
  });

  it("imports into folders and exports a CSV that re-imports cleanly", async () => {
    const ctx = await makeWorkspace();
    const headers = ["Name", "Folder", "Qty", "Barcode", "Supplier"];
    const data = [
      ["Gloves", "Warehouse / Aisle 1", "10", "111", "Acme"],
      ["Masks", "Warehouse / Aisle 1", "4", "", ""],
      ["Hammer", "", "1", "", ""],
      ["=HYPERLINK(\"x\")", "", "1", "", ""],
    ];
    const built = buildRows(headers, data, guessMapping(headers));
    const result = await importRows(db, ctx, built.rows);
    expect(result).toEqual({ items: 4, folders: 2 });

    const gloves = (await listItems(db, ctx, { search: "Gloves" }))[0];
    expect((await getFolderPath(db, ctx, gloves.folderId)).map((p) => p.name)).toEqual(["Warehouse", "Aisle 1"]);

    const csv = await exportCsv(db, ctx);
    const parsed = Papa.parse<string[]>(csv.trim());
    const [h, ...rows] = parsed.data;
    expect(h).toContain("Supplier");
    expect(rows.find((r) => r[0] === "Gloves")?.[1]).toBe("Warehouse / Aisle 1");
    // Formula injection is neutralized.
    expect(rows.some((r) => r[0].startsWith("'="))).toBe(true);

    // Round trip into a fresh workspace.
    const ctx2 = await makeWorkspace();
    const rebuilt = buildRows(h, rows, guessMapping(h));
    expect(rebuilt.errors).toEqual([]);
    expect((await importRows(db, ctx2, rebuilt.rows)).items).toBe(4);
  });
});
