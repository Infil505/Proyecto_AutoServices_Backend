import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { technicians, users } from '../db/schema.js';
import { createJWT, parseExpiresIn } from '../utils/jwt.js';

export class UserService {
  static async getAll() {
    return await db.select().from(users);
  }

  static async getById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  static async getByPhone(phone: string) {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    return result[0];
  }

  static async create(data: typeof users.$inferInsert) {
    const hashedPassword = await bcrypt.hash(data.passwordHash, config.bcryptRounds);
    const result = await db.insert(users).values({ ...data, passwordHash: hashedPassword }).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof users.$inferInsert>) {
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, config.bcryptRounds);
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

    let companyPhone: string | undefined;
    if (user.type === 'technician') {
      const tech = await db.select({ companyPhone: technicians.companyPhone })
        .from(technicians)
        .where(eq(technicians.phone, user.phone));
      companyPhone = tech[0]?.companyPhone;
    }

    const payload = {
      id: user.id,
      type: user.type,
      phone: user.phone,
      ...(companyPhone ? { companyPhone } : {}),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + parseExpiresIn(config.jwtExpiresIn)
    };

    const token = createJWT(payload, config.jwtSecret);
    return { user, token };
  }
}