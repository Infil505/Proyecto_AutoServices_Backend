/** Parse a route parameter as a positive integer. Returns null if invalid. */
export function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 1 ? null : n;
}
