import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { services } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class ServiceService {
  static async getAll(p?: Page) {
    const q = db.select().from(services);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(services);
    return Number(row?.value ?? 0);
  }

  static async getByCompany(companyPhone: string, p?: Page) {
    const q = db.select().from(services).where(eq(services.companyPhone, companyPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByCompany(companyPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(services).where(eq(services.companyPhone, companyPhone));
    return Number(row?.value ?? 0);
  }

  static async getById(id: number) {
    const result = await db.select().from(services).where(eq(services.id, id));
    return result[0];
  }

  static async create(data: typeof services.$inferInsert) {
    const result = await db.insert(services).values(data).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof services.$inferInsert>) {
    const result = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return result[0];
  }

  static async delete(id: number) {
    await db.delete(services).where(eq(services.id, id));
  }
}
