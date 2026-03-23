import { db } from '../db/index.js';
import { customers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class CustomerService {
  static async getAll() {
    return await db.select().from(customers);
  }

  static async getById(phone: string) {
    const result = await db.select().from(customers).where(eq(customers.phone, phone));
    return result[0];
  }

  static async create(data: typeof customers.$inferInsert) {
    const result = await db.insert(customers).values(data).returning();
    return result[0];
  }

  static async update(phone: string, data: Partial<typeof customers.$inferInsert>) {
    const result = await db.update(customers).set(data).where(eq(customers.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(customers).where(eq(customers.phone, phone));
  }
}