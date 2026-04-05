import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { specialties } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class SpecialtyService {
  static async getAll(p?: Page) {
    const q = db.select().from(specialties);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(specialties);
    return Number(row?.value ?? 0);
  }

  static async getById(id: number) {
    const result = await db.select().from(specialties).where(eq(specialties.id, id));
    return result[0];
  }

  static async create(data: typeof specialties.$inferInsert) {
    const result = await db.insert(specialties).values(data).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof specialties.$inferInsert>) {
    const result = await db.update(specialties).set(data).where(eq(specialties.id, id)).returning();
    return result[0];
  }

  static async delete(id: number) {
    await db.delete(specialties).where(eq(specialties.id, id));
  }
}
