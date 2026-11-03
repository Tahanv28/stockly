import { sql } from "drizzle-orm";
import type { DB } from "@/db";

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances).
 * Returns true if the action is allowed, false if the limit is exceeded.
 */
export async function rateLimit(
  db: DB,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
        then 1 else rate_limits.count + 1 end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
        then now() else rate_limits.window_start end
    returning count
  `);
  return Number(result.rows[0]?.count ?? 0) <= limit;
}

export async function resetRateLimit(db: DB, key: string) {
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}
