import bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

// Simple JWT implementation using Node.js crypto
function createJWT(payload: any, secret: string): string {
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const encodedHeader = Buffer.from(header).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export class UserService {
  static async getAll() {
    return await db.select().from(users);
  }

  static async getById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  static async create(data: typeof users.$inferInsert) {
    const hashedPassword = await bcrypt.hash(data.passwordHash, 10);
    const result = await db.insert(users).values({ ...data, passwordHash: hashedPassword }).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof users.$inferInsert>) {
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, 10);
    }
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  }

  static async delete(id: number) {
    await db.delete(users).where(eq(users.id, id));
  }

  static async authenticate(phone: string, password: string) {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    const user = result[0];
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    const payload = {
      id: user.id,
      type: user.type,
      phone: user.phone,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    };

    const token = createJWT(payload, process.env.JWT_SECRET!);
    return { user, token };
  }
}