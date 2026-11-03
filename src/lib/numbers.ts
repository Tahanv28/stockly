/**
 * Parses user-entered decimals like "12", "1.5", "1,5", " 3 ", "1 200,50".
 * Returns a normalized string suitable for a Postgres numeric column, or null if empty.
 * Throws on invalid input.
 */
export function parseDecimal(input: unknown, opts: { maxScale?: number } = {}): string | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (s === "") return null;
  s = s.replace(/[\s ']/g, "");
  // Strip common currency symbols.
  s = s.replace(/^[€$£]/, "").replace(/[€$£]$/, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Whichever comes last is the decimal separator.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`"${input}" is not a valid number`);
  const maxScale = opts.maxScale ?? 3;
  const [whole, frac = ""] = s.split(".");
  const trimmedFrac = frac.slice(0, maxScale).replace(/0+$/, "");
  const normalizedWhole = whole.replace(/^(-?)0+(?=\d)/, "$1");
  return trimmedFrac ? `${normalizedWhole}.${trimmedFrac}` : normalizedWhole;
}

/** Formats a numeric string for display: "12.500" -> "12.5", "3.000" -> "3". */
export function formatQty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function formatMoney(value: string | number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { style: "currency", currency });
}

export function isLowStock(quantity: string, minQuantity: string | null): boolean {
  if (minQuantity === null) return false;
  return Number(quantity) <= Number(minQuantity);
}
