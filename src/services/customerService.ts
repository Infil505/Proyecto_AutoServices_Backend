import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { customers } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class CustomerService {
  static async getAll(p?: Page) {
    const q = db.select().from(customers);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(customers);
    return Number(row?.value ?? 0);
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
