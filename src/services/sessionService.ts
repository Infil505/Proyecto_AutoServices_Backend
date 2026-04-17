import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';

export class SessionService {
  static async save(userId: number, jti: string, tokenType: 'access' | 'refresh', expiresAtSecs: number) {
    await db.insert(sessions).values({ userId, jti, tokenType, expiresAt: new Date(expiresAtSecs * 1000) });
  }

  static async revoke(jti: string) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.jti, jti));
  }

  static async isRevoked(jti: string): Promise<boolean> {
    const [row] = await db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.jti, jti));
    if (!row) return false;
    return row.revokedAt !== null;
  }

  static async getActiveByUser(userId: number) {
    const now = new Date();
    return db.select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
  }
}
