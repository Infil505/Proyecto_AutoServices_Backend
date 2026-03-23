import { z } from 'zod';

// User validation schemas
export const userSchema = z.object({
  type: z.enum(['technician', 'company', 'super_admin']),
  phone: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128)
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
  companyPhone: z.string().min(10).max(15),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  specialty: z.string().max(100).optional(),
  available: z.boolean().optional()
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
export const appointmentSchema = z.object({
  customerPhone: z.string().min(10).max(15).optional(),
  companyPhone: z.string().min(10).max(15),
  technicianPhone: z.string().min(10).max(15).optional(),
  serviceId: z.number().int().positive(),
  scheduledDate: z.string().datetime(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().max(1000).optional()
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
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
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