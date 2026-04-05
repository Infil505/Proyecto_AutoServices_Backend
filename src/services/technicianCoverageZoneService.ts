import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { technicianCoverageZones, coverageZones, technicians } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class TechnicianCoverageZoneService {
  static async getAll(p?: Page) {
    const q = db.select().from(technicianCoverageZones);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicianCoverageZones);
    return Number(row?.value ?? 0);
  }

  // All assignments for a technician (raw junction rows)
  static async getByTechnician(technicianPhone: string, p?: Page) {
    const q = db.select().from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByTechnician(technicianPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone));
    return Number(row?.value ?? 0);
  }

  // All assignments for a company — single JOIN, no N+1
  static async getByCompany(companyPhone: string, p?: Page) {
    const q = db
      .select({ assignment: technicianCoverageZones })
      .from(technicianCoverageZones)
      .innerJoin(technicians, eq(technicianCoverageZones.technicianPhone, technicians.phone))
      .where(eq(technicians.companyPhone, companyPhone));
    const rows = p ? await q.limit(p.limit).offset(p.offset) : await q;
    return rows.map(r => r.assignment);
  }

  static async countByCompany(companyPhone: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(technicianCoverageZones)
      .innerJoin(technicians, eq(technicianCoverageZones.technicianPhone, technicians.phone))
      .where(eq(technicians.companyPhone, companyPhone));
    return Number(row?.value ?? 0);
  }

  // All technicians assigned to a zone (raw junction rows)
  static async getByZone(coverageZoneId: number) {
    return await db.select().from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.coverageZoneId, coverageZoneId));
  }

  // Full zone data for a technician's assigned zones
  static async getZonesByTechnician(technicianPhone: string, p?: Page) {
    const q = db
      .select({ zone: coverageZones })
      .from(technicianCoverageZones)
      .innerJoin(coverageZones, eq(technicianCoverageZones.coverageZoneId, coverageZones.id))
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone));
    const rows = p ? await q.limit(p.limit).offset(p.offset) : await q;
    return rows.map(r => r.zone);
  }

  static async countZonesByTechnician(technicianPhone: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone));
    return Number(row?.value ?? 0);
  }

  // Full technician data for all technicians assigned to a zone
  static async getTechniciansByZone(coverageZoneId: number, p?: Page) {
    const q = db
      .select({ technician: technicians })
      .from(technicianCoverageZones)
      .innerJoin(technicians, eq(technicianCoverageZones.technicianPhone, technicians.phone))
      .where(eq(technicianCoverageZones.coverageZoneId, coverageZoneId));
    const rows = p ? await q.limit(p.limit).offset(p.offset) : await q;
    return rows.map(r => r.technician);
  }

  static async countTechniciansByZone(coverageZoneId: number): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.coverageZoneId, coverageZoneId));
    return Number(row?.value ?? 0);
  }

  // Check if a specific assignment exists
  static async getAssignment(technicianPhone: string, coverageZoneId: number) {
    const result = await db.select().from(technicianCoverageZones).where(
      and(
        eq(technicianCoverageZones.technicianPhone, technicianPhone),
        eq(technicianCoverageZones.coverageZoneId, coverageZoneId)
      )
    );
    return result[0];
  }

  static async create(data: typeof technicianCoverageZones.$inferInsert) {
    const result = await db.insert(technicianCoverageZones).values(data).returning();
    return result[0];
  }

  static async delete(technicianPhone: string, coverageZoneId: number) {
    await db.delete(technicianCoverageZones).where(
      and(
        eq(technicianCoverageZones.technicianPhone, technicianPhone),
        eq(technicianCoverageZones.coverageZoneId, coverageZoneId)
      )
    );
  }
}
