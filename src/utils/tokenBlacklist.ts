import { SessionService } from '../services/sessionService.js';
import { cacheGet, cacheSet } from './cache.js';

// Access tokens live 7 days; check DB once per 5 minutes per JTI.
// On logout, the revocation is written to cache immediately so the 5-min
// window only affects tokens that were never revoked (the normal case).
const JTI_TTL_MS = 5 * 60 * 1000;

export async function blacklistToken(jti: string): Promise<void> {
  await SessionService.revoke(jti);
  cacheSet(`jti:${jti}`, true, JTI_TTL_MS); // instant effect in this process
}

export async function isBlacklisted(jti: string): Promise<boolean> {
  const cached = cacheGet<boolean>(`jti:${jti}`);
  if (cached !== undefined) return cached;

  const revoked = await SessionService.isRevoked(jti);
  cacheSet(`jti:${jti}`, revoked, JTI_TTL_MS);
  return revoked;
}
