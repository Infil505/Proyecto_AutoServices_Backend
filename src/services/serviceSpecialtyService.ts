import { db } from '../db/index.js';
import { serviceSpecialties } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export class ServiceSpecialtyService {
  static async getAll() {
    return await db.select().from(serviceSpecialties);
  }

  static async getByServiceId(serviceId: number) {
    return await db.select().from(serviceSpecialties).where(eq(serviceSpecialties.serviceId, serviceId));
  }

  static async getBySpecialtyId(specialtyId: number) {
    return await db.select().from(serviceSpecialties).where(eq(serviceSpecialties.specialtyId, specialtyId));
  }

  static async create(data: typeof serviceSpecialties.$inferInsert) {
    const result = await db.insert(serviceSpecialties).values(data).returning();
    return result[0];
  }

  static async delete(serviceId: number, specialtyId: number) {
    await db.delete(serviceSpecialties).where(
      and(
        eq(serviceSpecialties.serviceId, serviceId),
        eq(serviceSpecialties.specialtyId, specialtyId)
      )
    );
  }
}