import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { technicians, users } from '../db/schema.js';
import { createJWT, parseExpiresIn } from '../utils/jwt.js';
import { SessionService } from './sessionService.js';

// Never expose passwordHash in API responses
const safeSelect = {
  id: users.id,
  type: users.type,
  phone: users.phone,
  name: users.name,
  email: users.email,
  companyPhone: users.companyPhone,
  createdAt: users.createdAt,
};

export class UserService {
  static async getAll() {
    return db.select(safeSelect).from(users);
  }

  static async getById(id: number) {
    const result = await db.select(safeSelect).from(users).where(eq(users.id, id));
    return result[0];
  }

  static async getByPhone(phone: string) {
    const result = await db.select(safeSelect).from(users).where(eq(users.phone, phone));
    return result[0];
  }

  static async create(data: typeof users.$inferInsert) {
    const hashedPassword = data.passwordHash
      ? await bcrypt.hash(data.passwordHash, config.bcryptRounds)
      : null;
    const result = await db.insert(users).values({ ...data, passwordHash: hashedPassword }).returning();
    const { passwordHash: _, ...safe } = result[0]!;
    return safe;
  }

  static async update(id: number, data: Partial<typeof users.$inferInsert>) {
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, config.bcryptRounds);
    }
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    if (!result[0]) return null;
    const { passwordHash: _, ...safe } = result[0];
    return safe;
  }

  static async hasPassword(id: number): Promise<boolean> {
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, id));
    return !!row?.passwordHash;
  }

  static async generateSetupToken(userId: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return createJWT({ userId, tokenType: 'setup', iat: now, exp: now + 86400 }, config.jwtSecret);
  }

  static async delete(id: number) {
    await db.delete(users).where(eq(users.id, id));
  }

  static async authenticate(phone: string, password: string): Promise<'not_activated' | { user: Record<string, unknown>; token: string; refreshToken: string } | null> {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    const user = result[0];
    if (!user) return null;

    if (!user.passwordHash) return 'not_activated';

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    let companyPhone: string | undefined;
    if (user.type === 'technician') {
      const tech = await db.select({ companyPhone: technicians.companyPhone })
        .from(technicians)
        .where(eq(technicians.phone, user.phone));
      companyPhone = tech[0]?.companyPhone;
    } else if (user.type === 'company') {
      companyPhone = user.companyPhone ?? user.phone;
    }

    const now = Math.floor(Date.now() / 1000);
    const accessExp = now + parseExpiresIn(config.jwtExpiresIn);
    const refreshExp = now + parseExpiresIn(config.jwtRefreshExpiresIn);
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const basePayload = {
      id: user.id,
      type: user.type,
      phone: user.phone,
      ...(companyPhone ? { companyPhone } : {}),
      iat: now,
    };

    const token = await createJWT(
      { ...basePayload, jti: accessJti, tokenType: 'access', exp: accessExp },
      config.jwtSecret
    );

    const refreshToken = await createJWT(
      { ...basePayload, jti: refreshJti, tokenType: 'refresh', exp: refreshExp },
      config.jwtSecret
    );

    await Promise.all([
      SessionService.save(user.id, accessJti, 'access', accessExp),
      SessionService.save(user.id, refreshJti, 'refresh', refreshExp),
    ]);

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token, refreshToken };
  }
}