import { db } from '../db/index.js';
import { coverageZones } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class CoverageZoneService {
  static async getAll() {
    return await db.select().from(coverageZones);
  }

  static async getByCompany(companyPhone: string) {
    return await db.select().from(coverageZones).where(eq(coverageZones.companyPhone, companyPhone));
  }

  static async getById(id: number) {
    const result = await db.select().from(coverageZones).where(eq(coverageZones.id, id));
    return result[0];
  }

  static async create(data: typeof coverageZones.$inferInsert) {
    const result = await db.insert(coverageZones).values(data).returning();
    return result[0];
  }

  static async update(id: number, data: Partial<typeof coverageZones.$inferInsert>) {
    const result = await db.update(coverageZones).set(data).where(eq(coverageZones.id, id)).returning();
    return result[0];
  }

  static async delete(id: number) {
    await db.delete(coverageZones).where(eq(coverageZones.id, id));
  }
}
