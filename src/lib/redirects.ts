/** Only allow same-site relative paths as redirect targets (prevents open redirects). */
export function safeNext(next: unknown, fallback = "/app"): string {
  const n = typeof next === "string" ? next : "";
  if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return fallback;
  return n;
}
