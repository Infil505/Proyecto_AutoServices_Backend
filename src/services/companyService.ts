import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { companies, users } from '../db/schema.js';
import { UserService } from './userService.js';
import { sendInviteEmail } from '../utils/email.js';

type Page = { limit: number; offset: number };

export class CompanyService {
  static async getAll(p?: Page) {
    const q = db.select().from(companies);
    if (p) return q.limit(p.limit).offset(p.offset);
    return q;
  }

  static async countAll(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(companies);
    return Number(row?.value ?? 0);
  }

  static async getById(phone: string) {
    const result = await db.select().from(companies).where(eq(companies.phone, phone));
    return result[0];
  }

  static async create(data: typeof companies.$inferInsert) {
    const result = await db.insert(companies).values(data).returning();
    return result[0];
  }

  static async register(data: {
    company: { phone: string; name: string; email?: string; address?: string; startHour?: string; endHour?: string };
    admin: { phone: string; name: string; email?: string };
  }): Promise<{ company: typeof companies.$inferSelect; setupToken: string }> {
    const { company, adminId } = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        phone: data.company.phone, name: data.company.name, email: data.company.email,
        address: data.company.address, startHour: data.company.startHour, endHour: data.company.endHour,
      }).returning();
      const [adminUser] = await tx.insert(users).values({
        type: 'company', phone: data.admin.phone, name: data.admin.name,
        email: data.admin.email, companyPhone: data.company.phone, passwordHash: null,
      }).returning({ id: users.id });
      return { company: company!, adminId: adminUser!.id };
    });

    const setupToken = await UserService.generateSetupToken(adminId);

    if (data.admin.email) {
      await sendInviteEmail({ to: data.admin.email, name: data.admin.name, role: 'company', token: setupToken });
    }

    return { company, setupToken };
  }

  static async update(phone: string, data: Partial<typeof companies.$inferInsert>) {
    const result = await db.update(companies).set(data).where(eq(companies.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(companies).where(eq(companies.phone, phone));
  }
}
