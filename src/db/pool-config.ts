import type { PoolConfig } from "pg";

/**
 * Builds pg Pool options from DATABASE_URL.
 * Hosted Postgres (Supabase, Neon) needs TLS. node-postgres treats `sslmode=require`
 * in the URL as "verify the certificate against Node's CA list", which fails for
 * providers with their own CA, and URL params override the `ssl` option. So we
 * strip `sslmode` from the URL and configure TLS explicitly (encrypted connection).
 */
export function poolConfig(connectionString: string, max?: number): PoolConfig {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const useSsl = sslmode ? sslmode !== "disable" : !isLocal;
  return {
    connectionString: url.toString(),
    max,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}
