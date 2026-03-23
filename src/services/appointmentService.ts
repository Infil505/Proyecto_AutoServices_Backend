import { db } from '../db/index.js';
import { appointments } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class AppointmentService {
  static async getAll() {
    return await db.select().from(appointments);
  }

  static async getById(id: number) {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }

  static async create(data: typeof appointments.$inferInsert) {
    const result = await db.insert(appointments).values(data).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof appointments.$inferInsert>) {
    const result = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning();
    return result[0];
  }

  static async delete(id: number) {
    await db.delete(appointments).where(eq(appointments.id, id));
  }
}