import { db } from '../db/index.js';
import { technicians } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class TechnicianService {
  static async getAll() {
    return await db.select().from(technicians);
  }

  static async getById(phone: string) {
    const result = await db.select().from(technicians).where(eq(technicians.phone, phone));
    return result[0];
  }

  static async create(data: typeof technicians.$inferInsert) {
    const result = await db.insert(technicians).values(data).returning();
    return result[0];
  }

  static async update(phone: string, data: Partial<typeof technicians.$inferInsert>) {
    const result = await db.update(technicians).set(data).where(eq(technicians.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(technicians).where(eq(technicians.phone, phone));
  }
}