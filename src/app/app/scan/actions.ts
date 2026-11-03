"use server";

import { db } from "@/db";
import { requireActionCtx } from "@/lib/session";
import { findItemsByCode } from "@/server/inventory";

export async function lookupCodeAction(code: string) {
  const { ctx } = await requireActionCtx();
  const matches = await findItemsByCode(db, ctx, code);
  return matches.map((m) => ({ id: m.id, name: m.name, quantity: m.quantity, unit: m.unit }));
}
