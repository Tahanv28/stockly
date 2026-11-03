import { formatQty } from "./numbers";

type A = {
  type: string;
  itemName: string | null;
  quantityBefore: string | null;
  quantityAfter: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  sku: "SKU",
  barcode: "barcode",
  unit: "unit",
  minQuantity: "low-stock level",
  price: "price",
  notes: "notes",
  tags: "tags",
  customFields: "custom fields",
};

export function describeActivity(a: A, withItem = true): { text: string; delta?: number } {
  const item = withItem && a.itemName ? ` ${a.itemName}` : "";
  switch (a.type) {
    case "item.created":
      return {
        text: `${a.note === "Imported" ? "Imported" : "Added"}${item || " item"} with ${formatQty(a.quantityAfter ?? "0")}`,
      };
    case "item.quantity": {
      const before = Number(a.quantityBefore ?? 0);
      const after = Number(a.quantityAfter ?? 0);
      const delta = after - before;
      const sign = delta > 0 ? "+" : "";
      return {
        text: `${sign}${formatQty(delta)}${item ? ` ·${item}` : ""} (${formatQty(before)} → ${formatQty(after)})${a.note ? ` — ${a.note}` : ""}`,
        delta,
      };
    }
    case "item.updated": {
      const fields = ((a.data?.fields as string[]) ?? []).map((f) => FIELD_LABELS[f] ?? f);
      return { text: `Edited${item}${fields.length ? `: ${fields.join(", ")}` : ""}` };
    }
    case "item.moved":
      return { text: `Moved${item || " item"}` };
    case "item.deleted":
      return { text: `Moved${item || " item"} to trash` };
    case "item.restored":
      return { text: `Restored${item || " item"} from trash` };
    case "item.imported":
      return { text: `Imported ${a.data?.count ?? ""} items` };
    case "folder.created":
      return { text: `Created folder ${String(a.data?.name ?? "")}` };
    case "folder.renamed":
      return { text: `Renamed folder ${String(a.data?.from ?? "")} → ${String(a.data?.to ?? "")}` };
    case "folder.deleted":
      return { text: `Deleted folder ${String(a.data?.name ?? "")}` };
    default:
      return { text: a.type };
  }
}

export function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
