export function pageFrom(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n < 100000 ? n : 1;
}
