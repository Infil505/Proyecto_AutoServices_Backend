import { SessionService } from '../services/sessionService.js';

export async function blacklistToken(jti: string): Promise<void> {
  await SessionService.revoke(jti);
}

export async function isBlacklisted(jti: string): Promise<boolean> {
  return SessionService.isRevoked(jti);
}
