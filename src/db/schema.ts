import { bigint, bigserial, boolean, date, integer, jsonb, pgTable, primaryKey, serial, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  phone: text('phone').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startHour: time('startHour', { withTimezone: true }),
  endHour: time('endHours', { withTimezone: true }), // DB column name is 'endHours'
});

export const customers = pgTable('customers', {
  phone: text('phone').primaryKey(),
  name: text('name'),
  email: text('email'),
  state: text('state'),
  city: text('city'),
  address: text('address'),
  content: text('content'),
  metadata: jsonb('metadata'),
  embedding: jsonb('embedding'), // USER-DEFINED (vector) in DB — stored as jsonb in ORM
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const technicians = pgTable('technicians', {
  phone: text('phone').primaryKey(),
  companyPhone: text('company_phone').notNull().references(() => companies.phone),
  name: text('name').notNull(),
  email: text('email'),
  available: boolean('available').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const specialties = pgTable('specialties', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const services = pgTable('services', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  companyPhone: text('company_phone').notNull().references(() => companies.phone),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  estimatedDurationMinutes: integer('estimated_duration_minutes').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const serviceSpecialties = pgTable('service_specialties', {
  serviceId: bigint('service_id', { mode: 'number' }).notNull().references(() => services.id),
  specialtyId: bigint('specialty_id', { mode: 'number' }).notNull().references(() => specialties.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.serviceId, table.specialtyId] }),
}));

export const technicianSpecialties = pgTable('technician_specialties', {
  technicianPhone: text('technician_phone').notNull().references(() => technicians.phone),
  specialtyId: bigint('specialty_id', { mode: 'number' }).notNull().references(() => specialties.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.technicianPhone, table.specialtyId] }),
}));

export const appointments = pgTable('appointments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  customerPhone: text('customer_phone').references(() => customers.phone),
  companyPhone: text('company_phone').notNull().references(() => companies.phone),
  technicianPhone: text('technician_phone').references(() => technicians.phone),
  appointmentDate: date('appointmentDate'),
  startTime: time('start_time'),
  status: text('status').default('pending'),
  content: text('content'),
  metadata: jsonb('metadata'),
  embedding: jsonb('embedding'), // USER-DEFINED (vector) in DB — stored as jsonb in ORM
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  coordinates: jsonb('coordinates'),
  serviceId: bigint('service_id', { mode: 'number' }).references(() => services.id),
});

export const coverageZones = pgTable('coverage_zones', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  companyPhone: text('company_phone').notNull().references(() => companies.phone),
  state: text('state').notNull(),
  city: text('city').notNull(),
  zoneName: text('zone_name'),
  postalCode: text('postal_code'),
  coordinates: jsonb('coordinates'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Not in DB dump — kept as-is since the auth system depends on it
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'technician' | 'company' | 'super_admin'
  phone: text('phone').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
