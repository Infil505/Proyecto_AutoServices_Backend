import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { appointments, customers, companies, technicians, services } from '../db/schema.js';

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

  static async getFullById(id: number) {
    const result = await db
      .select({
        appointment: appointments,
        customer: customers,
        company: companies,
        technician: technicians,
        service: services,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerPhone, customers.phone))
      .leftJoin(companies, eq(appointments.companyPhone, companies.phone))
      .leftJoin(technicians, eq(appointments.technicianPhone, technicians.phone))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, id));
    return result[0];
  }

  static async updateTechnicianStatus(id: number, estatusTecnico: boolean) {
    const result = await db
      .update(appointments)
      .set({ estatusTecnico })
      .where(eq(appointments.id, id))
      .returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
      if (appointment.estatusTecnico && appointment.estatusAdministrador) {
        AppointmentService.events.emit('appointment:both_completed', appointment);
      }
    }
    return appointment;
  }

  static async updateAdminStatus(id: number, estatusAdministrador: boolean) {
    const result = await db
      .update(appointments)
      .set({ estatusAdministrador })
      .where(eq(appointments.id, id))
      .returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
      if (appointment.estatusTecnico && appointment.estatusAdministrador) {
        AppointmentService.events.emit('appointment:both_completed', appointment);
      }
    }
    return appointment;
  }
}