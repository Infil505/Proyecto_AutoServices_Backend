import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { appointments } from '../db/schema.js';

export class AppointmentService {
  static events = new EventEmitter();

  static async getAll() {
    return await db.select().from(appointments);
  }

  static async getByTechnician(technicianPhone: string) {
    return await db.select().from(appointments).where(eq(appointments.technicianPhone, technicianPhone));
  }

  static async getByCompany(companyPhone: string) {
    return await db.select().from(appointments).where(eq(appointments.companyPhone, companyPhone));
  }

  static async getById(id: number) {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }

  static async create(data: typeof appointments.$inferInsert) {
    const result = await db.insert(appointments).values(data).returning();
    const appointment = result[0];
    AppointmentService.events.emit('appointment:created', appointment);
    return appointment;
  }

  static async update(id: number, data: Partial<typeof appointments.$inferInsert>) {
    const result = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
    }
    return appointment;
  }

  static async delete(id: number) {
    const existing = await AppointmentService.getById(id);
    await db.delete(appointments).where(eq(appointments.id, id));
    AppointmentService.events.emit('appointment:deleted', existing ?? { id });
  }
}