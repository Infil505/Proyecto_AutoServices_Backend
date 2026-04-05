import bcrypt from 'bcrypt';
import { count, eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { companies, users } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class CompanyService {
  static async getAll(p?: Page) {
    const q = db.select().from(companies);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(companies);
    return Number(row?.value ?? 0);
  }

  static async getById(phone: string) {
    const result = await db.select().from(companies).where(eq(companies.phone, phone));
    return result[0];
  }

  static async create(data: typeof companies.$inferInsert) {
    const result = await db.insert(companies).values(data).returning();
    return result[0];
  }

  static async register(data: {
    phone: string; name: string; email?: string; password: string;
    address?: string; startHour?: string; endHour?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, config.bcryptRounds);
    return await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        phone: data.phone, name: data.name, email: data.email,
        address: data.address, startHour: data.startHour, endHour: data.endHour,
      }).returning();
      await tx.insert(users).values({
        type: 'company', phone: data.phone, name: data.name,
        email: data.email, passwordHash: hashedPassword,
      });
      return company;
    });
  }

  static async update(phone: string, data: Partial<typeof companies.$inferInsert>) {
    const result = await db.update(companies).set(data).where(eq(companies.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(companies).where(eq(companies.phone, phone));
  }
}
