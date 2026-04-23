import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { technicians, users } from '../db/schema.js';
import { UserService } from './userService.js';
import { sendInviteEmail } from '../utils/email.js';

type Page = { limit: number; offset: number };

export class TechnicianService {
  static async getAll(p?: Page) {
    const q = db.select().from(technicians);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicians);
    return Number(row?.value ?? 0);
  }

  static async getByCompany(companyPhone: string, p?: Page) {
    const q = db.select().from(technicians).where(eq(technicians.companyPhone, companyPhone));
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countByCompany(companyPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicians).where(eq(technicians.companyPhone, companyPhone));
    return Number(row?.value ?? 0);
  }

  static async countAvailableByCompany(companyPhone: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(technicians)
      .where(and(eq(technicians.companyPhone, companyPhone), eq(technicians.available, true)));
    return Number(row?.value ?? 0);
  }

  static async getById(phone: string) {
    const result = await db.select().from(technicians).where(eq(technicians.phone, phone));
    return result[0];
  }

  static async create(data: typeof technicians.$inferInsert) {
    const result = await db.insert(technicians).values(data).returning();
    return result[0];
  }

  static async register(data: {
    phone: string; name: string; email?: string;
    companyPhone: string; available?: boolean;
  }): Promise<{ technician: typeof technicians.$inferSelect; setupToken: string }> {
    const { technician, userId } = await db.transaction(async (tx) => {
      const [technician] = await tx.insert(technicians).values({
        phone: data.phone, name: data.name, email: data.email,
        companyPhone: data.companyPhone, available: data.available,
      }).returning();
      const [userRow] = await tx.insert(users).values({
        type: 'technician', phone: data.phone, name: data.name,
        email: data.email, companyPhone: data.companyPhone, passwordHash: null,
      }).returning({ id: users.id });
      return { technician: technician!, userId: userRow!.id };
    });

    const setupToken = await UserService.generateSetupToken(userId);

    if (data.email) {
      await sendInviteEmail({ to: data.email, name: data.name, role: 'technician', token: setupToken });
    }

    return { technician, setupToken };
  }

  static async update(phone: string, data: Partial<typeof technicians.$inferInsert>) {
    const result = await db.update(technicians).set(data).where(eq(technicians.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(technicians).where(eq(technicians.phone, phone));
  }
}
