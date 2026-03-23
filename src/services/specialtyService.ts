import { db } from '../db/index.js';
import { specialties } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class SpecialtyService {
  static async getAll() {
    return await db.select().from(specialties);
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