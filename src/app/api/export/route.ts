import { db } from "@/db";
import { getSession, toCtx } from "@/lib/session";
import { exportCsv } from "@/server/import-export";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const csv = await exportCsv(db, toCtx(session));
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stockly-export-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
