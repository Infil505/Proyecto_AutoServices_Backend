import { z } from 'zod';

const phoneField = z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/);
const passwordField = z.string().min(8).max(128);

// Company self-registration (public)
export const companyRegisterSchema = z.object({
  phone: phoneField,
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  password: passwordField,
  address: z.string().max(500).optional(),
  startHour: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endHour: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
});

// Super admin creation (protected, super_admin only)
export const adminRegisterSchema = z.object({
  phone: phoneField,
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  password: passwordField,
});

export const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(1)
});

// Company validation schemas
export const companySchema = z.object({
  phone: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  startHour: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endHour: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
});

// Technician validation schemas
export const technicianSchema = z.object({
  phone: phoneField,
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  password: passwordField,
  companyPhone: phoneField.optional(), // required for super_admin; auto-set from JWT for company role
  available: z.boolean().optional(),
});

// Service validation schemas
export const serviceSchema = z.object({
  companyPhone: z.string().min(10).max(15),
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440)
});

// Appointment validation schemas
export const appointmentStatusEnum = z.enum(['pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']);

export const appointmentSchema = z.object({
  customerPhone: z.string().min(10).max(15).optional(),
  companyPhone: z.string().min(10).max(15),
  technicianPhone: z.string().min(10).max(15).optional(),
  serviceId: z.number().int().positive().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  status: appointmentStatusEnum.optional(),
  content: z.string().max(2000).optional(),
});

// Customer validation schemas
export const customerSchema = z.object({
  phone: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/),
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  state: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  content: z.string().max(2000).optional()
});

// Coverage zone validation schemas
export const coverageZoneSchema = z.object({
  companyPhone: z.string().min(10).max(15),
  state: z.string().min(2).max(50),
  city: z.string().min(2).max(100),
  zoneName: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  coordinates: z.any().optional(), // GeoJSON
  notes: z.string().max(500).optional()
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Search/Filter schemas
export const appointmentFilterSchema = z.object({
  status: appointmentStatusEnum.optional(),
  technicianPhone: z.string().optional(),
  customerPhone: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

export const serviceFilterSchema = z.object({
  category: z.string().optional(),
  companyPhone: z.string().optional(),
  active: z.boolean().optional()
});

// Specialty validation schemas
export const specialtySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  active: z.boolean().optional()
});

// Service specialty validation schemas
export const serviceSpecialtySchema = z.object({
  serviceId: z.number().int().positive(),
  specialtyId: z.number().int().positive()
});

// Technician specialty validation schemas
export const technicianSpecialtySchema = z.object({
  technicianPhone: z.string().min(10).max(15),
  specialtyId: z.number().int().positive()
});