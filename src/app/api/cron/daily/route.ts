import { sql } from "drizzle-orm";
import { db } from "@/db";

// Daily maintenance, triggered by Vercel Cron (see vercel.json).
// - Removes expired sessions, used/expired invites and old rate-limit counters.
// - Touches the database, which also helps keep free-tier databases from pausing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessions = await db.execute(sql`delete from sessions where expires_at < now()`);
  const invites = await db.execute(
    sql`delete from invites where expires_at < now() - interval '30 days' or accepted_at < now() - interval '30 days'`,
  );
  const limits = await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  return Response.json({
    ok: true,
    removed: { sessions: sessions.rowCount, invites: invites.rowCount, rateLimits: limits.rowCount },
  });
}
