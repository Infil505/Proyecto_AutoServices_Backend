import { and, count, eq, ne } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { appointments, customers, companies, technicians, services } from '../db/schema.js';

type Page = { limit: number; offset: number };

export class AppointmentService {
  static events = new EventEmitter();

  static async getAll(p?: Page) {
    const q = db.select().from(appointments);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(appointments);
    return Number(row?.value ?? 0);
  }

  static async getByTechnician(technicianPhone: string, p?: Page) {
    const q = db.select().from(appointments).where(eq(appointments.technicianPhone, technicianPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByTechnician(technicianPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(appointments).where(eq(appointments.technicianPhone, technicianPhone));
    return Number(row?.value ?? 0);
  }

  static async getByCompany(companyPhone: string, p?: Page) {
    const q = db.select().from(appointments).where(eq(appointments.companyPhone, companyPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByCompany(companyPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(appointments).where(eq(appointments.companyPhone, companyPhone));
    return Number(row?.value ?? 0);
  }

  static async getByTechnicianAndDate(technicianPhone: string, date: string) {
    return await db.select().from(appointments).where(
      and(
        eq(appointments.technicianPhone, technicianPhone),
        eq(appointments.appointmentDate, date),
        ne(appointments.status, 'cancelled')
      )
    );
  }

  static async getById(id: number) {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }

  static async create(data: typeof appointments.$inferInsert) {
    const result = await db.insert(appointments).values(data).returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:created', appointment);
      if (appointment.technicianPhone) {
        AppointmentService.events.emit('appointment:assigned', appointment);
      }
    }
    return appointment;
  }

  static async update(id: number, data: Partial<typeof appointments.$inferInsert>) {
    const current = await AppointmentService.getById(id);
    const result = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
      const wasUnassigned = !current?.technicianPhone;
      const isNowAssigned = !!appointment.technicianPhone;
      const techChanged = current?.technicianPhone !== appointment.technicianPhone;
      if (isNowAssigned && (wasUnassigned || techChanged)) {
        AppointmentService.events.emit('appointment:assigned', appointment);
      }
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
      .select({ appointment: appointments, customer: customers, company: companies, technician: technicians, service: services })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerPhone, customers.phone))
      .leftJoin(companies, eq(appointments.companyPhone, companies.phone))
      .leftJoin(technicians, eq(appointments.technicianPhone, technicians.phone))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, id));
    return result[0];
  }

  static async updateTechnicianStatus(id: number, estatusTecnico: boolean) {
    const current = await AppointmentService.getById(id);
    const willComplete = estatusTecnico && !!current?.estatusAdministrador;
    const updateData: Partial<typeof appointments.$inferInsert> = { estatusTecnico };
    if (willComplete) updateData.status = 'completed';
    const result = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
      if (willComplete) AppointmentService.events.emit('appointment:both_completed', appointment);
    }
    return appointment;
  }

  static async updateAdminStatus(id: number, estatusAdministrador: boolean) {
    const current = await AppointmentService.getById(id);
    const willComplete = estatusAdministrador && !!current?.estatusTecnico;
    const updateData: Partial<typeof appointments.$inferInsert> = { estatusAdministrador };
    if (willComplete) updateData.status = 'completed';
    const result = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    const appointment = result[0];
    if (appointment) {
      AppointmentService.events.emit('appointment:updated', appointment);
      if (willComplete) AppointmentService.events.emit('appointment:both_completed', appointment);
    }
    return appointment;
  }
}
