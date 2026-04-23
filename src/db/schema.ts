import { bigint, bigserial, boolean, date, index, integer, jsonb, pgTable, primaryKey, serial, text, time, timestamp } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  phone: text('phone').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startHour: time('startHour', { withTimezone: true }),
  endHour: time('endHours', { withTimezone: true }), // DB column name is 'endHours'
}, (t) => ({
  createdAtIdx: index('idx_companies_created_at').on(t.createdAt),
}));

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
}, (t) => ({
  companyPhoneIdx: index('idx_technicians_company_phone').on(t.companyPhone),
  availableIdx:    index('idx_technicians_available').on(t.available),
}));

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
}, (t) => ({
  companyPhoneIdx: index('idx_services_company_phone').on(t.companyPhone),
  activeIdx:       index('idx_services_active').on(t.active),
}));

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
  description: text('description'),
  estatusTecnico: boolean('estatus_tecnico'),
  estatusAdministrador: boolean('estatus_administrador'),
}, (t) => ({
  companyPhoneIdx:    index('idx_appointments_company_phone').on(t.companyPhone),
  technicianPhoneIdx: index('idx_appointments_technician_phone').on(t.technicianPhone),
  statusIdx:          index('idx_appointments_status').on(t.status),
  createdAtIdx:       index('idx_appointments_created_at').on(t.createdAt),
  appointmentDateIdx: index('idx_appointments_appointment_date').on(t.appointmentDate),
}));

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
}, (t) => ({
  companyPhoneIdx: index('idx_coverage_zones_company_phone').on(t.companyPhone),
}));

export const technicianCoverageZones = pgTable('technician_coverage_zones', {
  technicianPhone: text('technician_phone').notNull().references(() => technicians.phone, { onDelete: 'cascade' }),
  coverageZoneId: bigint('coverage_zone_id', { mode: 'number' }).notNull().references(() => coverageZones.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.technicianPhone, table.coverageZoneId] }),
}));

// Not in DB dump — kept as-is since the auth system depends on it
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'technician' | 'company' | 'super_admin'
  phone: text('phone').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  companyPhone: text('company_phone').references(() => companies.phone, { onDelete: 'cascade' }),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  phoneIdx: index('idx_users_phone').on(t.phone),
}));

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jti: text('jti').notNull().unique(),
  tokenType: text('token_type').notNull(), // 'access' | 'refresh'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
