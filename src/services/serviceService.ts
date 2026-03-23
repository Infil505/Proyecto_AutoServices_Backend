import { db } from '../db/index.js';
import { services } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class ServiceService {
  static async getAll() {
    return await db.select().from(services);
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