import { db } from '../db/index.js';
import { technicianSpecialties } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export class TechnicianSpecialtyService {
  static async getAll() {
    return await db.select().from(technicianSpecialties);
  }

  static async getByTechnicianPhone(technicianPhone: string) {
    return await db.select().from(technicianSpecialties).where(eq(technicianSpecialties.technicianPhone, technicianPhone));
  }

  static async getBySpecialtyId(specialtyId: number) {
    return await db.select().from(technicianSpecialties).where(eq(technicianSpecialties.specialtyId, specialtyId));
  }

  static async create(data: typeof technicianSpecialties.$inferInsert) {
    const result = await db.insert(technicianSpecialties).values(data).returning();
    return result[0];
  }

  static async delete(technicianPhone: string, specialtyId: number) {
    await db.delete(technicianSpecialties).where(
      and(
        eq(technicianSpecialties.technicianPhone, technicianPhone),
        eq(technicianSpecialties.specialtyId, specialtyId)
      )
    );
  }
}