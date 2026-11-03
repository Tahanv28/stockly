import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __stocklyPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

// Reuse one pool across hot reloads in development.
const pool = globalForDb.__stocklyPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__stocklyPool = pool;

export const db: DB = drizzle(pool, { schema });
export { schema };
