import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { technicianCoverageZones, coverageZones, technicians } from '../db/schema.js';

export class TechnicianCoverageZoneService {
  static async getAll() {
    return await db.select().from(technicianCoverageZones);
  }

  // Todas las asignaciones de un técnico
  static async getByTechnician(technicianPhone: string) {
    return await db.select().from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone));
  }

  // Todos los técnicos asignados a una zona
  static async getByZone(coverageZoneId: number) {
    return await db.select().from(technicianCoverageZones)
      .where(eq(technicianCoverageZones.coverageZoneId, coverageZoneId));
  }

  // Zonas completas (con datos) a las que está asignado un técnico
  static async getZonesByTechnician(technicianPhone: string) {
    return await db
      .select({ zone: coverageZones })
      .from(technicianCoverageZones)
      .innerJoin(coverageZones, eq(technicianCoverageZones.coverageZoneId, coverageZones.id))
      .where(eq(technicianCoverageZones.technicianPhone, technicianPhone))
      .then(rows => rows.map(r => r.zone));
  }

  // Técnicos completos (con datos) asignados a una zona
  static async getTechniciansByZone(coverageZoneId: number) {
    return await db
      .select({ technician: technicians })
      .from(technicianCoverageZones)
      .innerJoin(technicians, eq(technicianCoverageZones.technicianPhone, technicians.phone))
      .where(eq(technicianCoverageZones.coverageZoneId, coverageZoneId))
      .then(rows => rows.map(r => r.technician));
  }

  // Verificar si existe una asignación concreta
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
