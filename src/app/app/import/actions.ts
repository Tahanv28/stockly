"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireActionCtx } from "@/lib/session";
import { buildRows, MAX_IMPORT_ROWS, TARGETS, type Target } from "@/lib/csv-import";
import { importRows } from "@/server/import-export";
import { InventoryError } from "@/server/inventory";

const schema = z.object({
  headers: z.array(z.string().max(200)).max(200),
  data: z.array(z.array(z.string().max(5000))).max(MAX_IMPORT_ROWS + 1),
  mapping: z.array(z.enum(Object.keys(TARGETS) as [Target, ...Target[]])),
});

export async function importAction(input: unknown) {
  const { ctx } = await requireActionCtx();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "The file couldn't be read. Make sure it's a CSV export." };
  const { headers, data, mapping } = parsed.data;
  if (mapping.length !== headers.length) return { error: "Column mapping doesn't match the file." };
  if (!mapping.includes("name")) return { error: 'Choose which column is the item "Name".' };

  const built = buildRows(headers, data, mapping);
  try {
    const result = await importRows(db, ctx, built.rows);
    revalidatePath("/app", "layout");
    return { ok: true as const, ...result, errors: built.errors.length };
  } catch (e) {
    if (e instanceof InventoryError) return { error: e.message };
    throw e;
  }
}
