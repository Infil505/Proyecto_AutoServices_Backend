import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { coverageZones } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class CoverageZoneService {
  static async getAll(p?: Page) {
    const q = db.select().from(coverageZones);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(coverageZones);
    return Number(row?.value ?? 0);
  }

  static async getByCompany(companyPhone: string, p?: Page) {
    const q = db.select().from(coverageZones).where(eq(coverageZones.companyPhone, companyPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByCompany(companyPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(coverageZones).where(eq(coverageZones.companyPhone, companyPhone));
    return Number(row?.value ?? 0);
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
