/**
 * In-memory token blacklist.
 *
 * When a user logs out, their access token's JTI is added here.
 * The JWT middleware rejects any token whose JTI is in this set.
 *
 * Entries are automatically evicted once their original expiry passes,
 * so memory usage is bounded by the number of active sessions that
 * have been explicitly logged out.
 */

// Map<jti, expiresAtMs>
const blacklist = new Map<string, number>();

/** Add a JTI to the blacklist until its natural expiry. */
export function blacklistToken(jti: string, expSeconds: number): void {
  blacklist.set(jti, expSeconds * 1000);
}

/** Returns true if the JTI has been revoked and the token is still within its original TTL. */
export function isBlacklisted(jti: string): boolean {
  const exp = blacklist.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) {
    blacklist.delete(jti);
    return false;
  }
  return true;
}

// Purge stale entries once an hour so the map doesn't grow unboundedly
// on servers with very long uptime.
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of blacklist) {
    if (now > exp) blacklist.delete(jti);
  }
}, 3_600_000).unref();
