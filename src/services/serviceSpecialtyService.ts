import { count, eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { serviceSpecialties } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class ServiceSpecialtyService {
  static async getAll(p?: Page) {
    const q = db.select().from(serviceSpecialties);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(serviceSpecialties);
    return Number(row?.value ?? 0);
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