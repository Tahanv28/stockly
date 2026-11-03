/**
 * CSV import logic shared by the browser (preview) and the server (actual import).
 * Understands Sortly exports out of the box and most generic inventory spreadsheets.
 */
import { parseDecimal } from "./numbers";

export const TARGETS = {
  name: "Name",
  quantity: "Quantity",
  unit: "Unit",
  minQuantity: "Low-stock level",
  price: "Price",
  sku: "SKU",
  barcode: "Barcode",
  tags: "Tags",
  notes: "Notes",
  folderPath: "Folder path",
  folderLevel: "Folder level (Sortly-style)",
  custom: "Custom field",
  ignore: "Don't import",
} as const;

export type Target = keyof typeof TARGETS;

const ALIASES: Record<Exclude<Target, "custom" | "ignore" | "folderLevel">, string[]> = {
  name: ["name", "entry name", "item name", "item", "title", "product", "product name", "description name"],
  quantity: ["quantity", "qty", "stock", "count", "on hand", "in stock", "amount", "current quantity"],
  unit: ["unit", "units", "uom", "unit of measure"],
  minQuantity: [
    "min level", "min quantity", "minimum", "minimum quantity", "min", "reorder point", "reorder level",
    "low stock", "low stock level", "alert level", "min stock",
  ],
  price: ["price", "unit price", "cost", "unit cost", "price per unit"],
  sku: ["sku", "part number", "part no", "item code", "product code", "article number"],
  barcode: ["barcode", "barcode/qr1-data", "barcode/qr1 data", "upc", "ean", "gtin", "qr", "qr code", "barcode data"],
  tags: ["tags", "tag", "labels", "categories", "category"],
  notes: ["notes", "note", "description", "comments", "comment"],
  folderPath: ["folder", "folder path", "location", "path", "folder name", "storage location"],
};

// Columns from Sortly exports that are internal or derived and shouldn't become fields.
const IGNORE = new Set([
  "sortly id (sid)", "sid", "value", "total value", "barcode/qr1-type", "barcode/qr2-type",
  "variant details", "stockly id", "photos", "photo", "images", "updated at", "created at",
]);

const normalize = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

function isFolderLevel(h: string) {
  const n = normalize(h);
  return n === "main folder" || /^subfolder[- ]?level ?\d+$/.test(n) || /^folder ?level ?\d+$/.test(n);
}

export function guessMapping(headers: string[]): Target[] {
  const used = new Set<Target>();
  return headers.map((h) => {
    const n = normalize(h);
    if (!n) return "ignore";
    if (isFolderLevel(h)) return "folderLevel";
    if (IGNORE.has(n)) return "ignore";
    for (const [target, aliases] of Object.entries(ALIASES) as [Target, string[]][]) {
      if (!used.has(target) && aliases.includes(n)) {
        used.add(target);
        return target;
      }
    }
    // Sortly's second barcode column, etc.
    if (n.startsWith("barcode/qr")) return "ignore";
    return "custom";
  });
}

export type ImportRow = {
  line: number;
  name: string;
  quantity: string | null;
  unit: string | null;
  minQuantity: string | null;
  price: string | null;
  sku: string | null;
  barcode: string | null;
  tags: string[];
  notes: string | null;
  folderPath: string[];
  customFields: Record<string, string>;
};

export type BuildResult = {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  skipped: number;
};

export const MAX_IMPORT_ROWS = 5000;

function splitPath(v: string) {
  return v
    .split(/\s*(?:\/|>|\\|»)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Turns raw CSV cells into validated item rows. `data` excludes the header row. */
export function buildRows(headers: string[], data: string[][], mapping: Target[]): BuildResult {
  const rows: ImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  let skipped = 0;
  const levelCols = mapping
    .map((t, i) => (t === "folderLevel" ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => levelOrder(headers[a]) - levelOrder(headers[b]));

  data.slice(0, MAX_IMPORT_ROWS).forEach((cells, idx) => {
    const line = idx + 2; // +1 for header, +1 for 1-based line numbers
    const get = (t: Target) => {
      const i = mapping.indexOf(t);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    if (cells.every((c) => !String(c ?? "").trim())) {
      skipped++;
      return;
    }
    const name = get("name");
    if (!name) {
      errors.push({ line, message: "Missing name — row skipped." });
      return;
    }
    try {
      const folderPath = mapping.includes("folderPath")
        ? splitPath(get("folderPath"))
        : levelCols.map((i) => (cells[i] ?? "").trim()).filter(Boolean);
      const customFields: Record<string, string> = {};
      mapping.forEach((t, i) => {
        if (t === "custom") {
          const v = (cells[i] ?? "").trim();
          if (v && headers[i]?.trim()) customFields[headers[i].trim()] = v;
        }
      });
      const quantity = parseDecimal(get("quantity"));
      if (quantity !== null && Number(quantity) < 0) throw new Error("Quantity can't be negative");
      rows.push({
        line,
        name: name.slice(0, 200),
        quantity,
        unit: get("unit") || null,
        minQuantity: parseDecimal(get("minQuantity")),
        price: parseDecimal(get("price"), { maxScale: 2 }),
        sku: get("sku") || null,
        barcode: get("barcode") || null,
        tags: get("tags")
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean),
        notes: get("notes") || null,
        folderPath,
        customFields,
      });
    } catch (e) {
      errors.push({ line, message: `${(e as Error).message} — row skipped.` });
    }
  });
  if (data.length > MAX_IMPORT_ROWS) {
    errors.push({ line: MAX_IMPORT_ROWS + 2, message: `Only the first ${MAX_IMPORT_ROWS} rows are imported at once.` });
  }
  return { rows, errors, skipped };
}

function levelOrder(h: string) {
  const n = normalize(h);
  if (n === "main folder") return 0;
  const m = n.match(/(\d+)/);
  return m ? Number(m[1]) + 1 : 99;
}
