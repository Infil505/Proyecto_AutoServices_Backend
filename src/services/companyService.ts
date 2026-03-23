import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class CompanyService {
  static async getAll() {
    return await db.select().from(companies);
  }

  static async getById(phone: string) {
    const result = await db.select().from(companies).where(eq(companies.phone, phone));
    return result[0];
  }

  static async create(data: typeof companies.$inferInsert) {
    const result = await db.insert(companies).values(data).returning();
    return result[0];
  }

  static async update(phone: string, data: Partial<typeof companies.$inferInsert>) {
    const result = await db.update(companies).set(data).where(eq(companies.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(companies).where(eq(companies.phone, phone));
  }
}