import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { technicians, users } from '../db/schema.js';

export class TechnicianService {
  static async getAll() {
    return await db.select().from(technicians);
  }

  static async getByCompany(companyPhone: string) {
    return await db.select().from(technicians).where(eq(technicians.companyPhone, companyPhone));
  }

  static async getById(phone: string) {
    const result = await db.select().from(technicians).where(eq(technicians.phone, phone));
    return result[0];
  }

  static async create(data: typeof technicians.$inferInsert) {
    const result = await db.insert(technicians).values(data).returning();
    return result[0];
  }

  /** Creates technician + user account in a single transaction. */
  static async register(data: {
    phone: string;
    name: string;
    email?: string;
    password: string;
    companyPhone: string;
    available?: boolean;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, config.bcryptRounds);
    return await db.transaction(async (tx) => {
      const [technician] = await tx.insert(technicians).values({
        phone: data.phone,
        name: data.name,
        email: data.email,
        companyPhone: data.companyPhone,
        available: data.available,
      }).returning();
      await tx.insert(users).values({
        type: 'technician',
        phone: data.phone,
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
      });
      return technician;
    });
  }

  static async update(phone: string, data: Partial<typeof technicians.$inferInsert>) {
    const result = await db.update(technicians).set(data).where(eq(technicians.phone, phone)).returning();
    return result[0];
  }

  static async delete(phone: string) {
    await db.delete(technicians).where(eq(technicians.phone, phone));
  }
}