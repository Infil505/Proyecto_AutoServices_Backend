import { count, eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { technicianSpecialties } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class TechnicianSpecialtyService {
  static async getAll(p?: Page) {
    const q = db.select().from(technicianSpecialties);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicianSpecialties);
    return Number(row?.value ?? 0);
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