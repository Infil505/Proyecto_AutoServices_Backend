import type { ZodError } from 'zod';

/**
 * Central error catalog.
 * All HTTP error responses used across the app are defined here.
 * To change a message or status code, edit it once in this file.
 */
export const Errors = {
  // ── Generic ──────────────────────────────────────────────────────────────────
  INVALID_JSON:               { status: 400, error: 'Invalid JSON' },
  VALIDATION_FAILED:          { status: 400, error: 'Validation failed' },
  NOT_FOUND:                  { status: 404, error: 'Not found' },
  UNAUTHORIZED:               { status: 403, error: 'Unauthorized' },
  FORBIDDEN:                  { status: 403, error: 'Forbidden' },
  INTERNAL_ERROR:             { status: 500, error: 'Internal Server Error' },

  // ── Auth ─────────────────────────────────────────────────────────────────────
  MISSING_AUTH_HEADER:        { status: 401, error: 'Missing authorization header' },
  INVALID_TOKEN:              { status: 401, error: 'Invalid token' },
  INVALID_CREDENTIALS:        { status: 401, error: 'Invalid credentials' },
  INVALID_REFRESH_TOKEN:      { status: 401, error: 'Invalid or expired refresh token' },
  REFRESH_TOKEN_REQUIRED:     { status: 400, error: 'refreshToken is required' },
  ONLY_SUPER_ADMIN:           { status: 403, error: 'Only super_admins can perform this action' },

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  TOO_MANY_REQUESTS:          { status: 429, error: 'Too many requests' },
  TOO_MANY_ATTEMPTS:          { status: 429, error: 'Too many attempts' },

  // ── Database (PostgreSQL error codes) ─────────────────────────────────────────
  DB_UNIQUE_VIOLATION:        { status: 409, error: 'Resource already exists' },
  DB_FK_VIOLATION:            { status: 400, error: 'Referenced resource does not exist' },
  DB_NULL_VIOLATION:          { status: 400, error: 'A required field is missing' },
  DB_CHECK_VIOLATION:         { status: 400, error: 'A field value does not meet the required constraints' },

  // ── Companies ─────────────────────────────────────────────────────────────────
  COMPANY_CREATE_ONLY_ADMIN:  { status: 403, error: 'Only super_admins can create companies' },
  COMPANY_UPDATE_OWN:         { status: 403, error: 'Can only update own company' },
  COMPANY_DELETE_OWN:         { status: 403, error: 'Can only delete own company' },

  // ── Technicians ───────────────────────────────────────────────────────────────
  TECHNICIAN_CREATE_ONLY:           { status: 403, error: 'Only companies and super_admins can create technicians' },
  TECHNICIAN_COMPANY_PHONE_REQUIRED: { status: 400, error: 'companyPhone is required' },
  TECHNICIAN_OWN_DATA:              { status: 403, error: 'Can only access own data' },
  TECHNICIAN_OWN_UPDATE:            { status: 403, error: 'Can only update own data' },
  TECHNICIAN_OWN_DELETE:            { status: 403, error: 'Can only delete own data' },
  TECHNICIAN_OWN_AVAILABILITY:      { status: 403, error: 'Can only access own availability' },
  TECHNICIAN_OWN_COMPANY_ACCESS:    { status: 403, error: 'Can only access own technicians' },
  TECHNICIAN_OWN_COMPANY_UPDATE:    { status: 403, error: 'Can only update own technicians' },
  TECHNICIAN_OWN_COMPANY_DELETE:    { status: 403, error: 'Can only delete own technicians' },

  // ── Customers ─────────────────────────────────────────────────────────────────
  CUSTOMER_CREATE_ONLY:   { status: 403, error: 'Only companies and super_admins can create customers' },
  CUSTOMER_UPDATE_ONLY:   { status: 403, error: 'Only companies and super_admins can update customers' },
  CUSTOMER_DELETE_ONLY:   { status: 403, error: 'Only companies and super_admins can delete customers' },

  // ── Services ──────────────────────────────────────────────────────────────────
  SERVICE_CREATE_ONLY:    { status: 403, error: 'Only companies and super_admins can create services' },
  SERVICE_UPDATE_OWN:     { status: 403, error: 'Can only update own services' },
  SERVICE_DELETE_OWN:     { status: 403, error: 'Can only delete own services' },

  // ── Users ─────────────────────────────────────────────────────────────────────
  USER_CREATE_ONLY_ADMIN:     { status: 403, error: 'Only super_admins can create users' },
  USER_OWN_DATA:              { status: 403, error: 'Can only access own data' },
  USER_OWN_UPDATE:            { status: 403, error: 'Can only update own data' },
  USER_OWN_DELETE:            { status: 403, error: 'Can only delete own data' },
  USER_OWN_BUSINESS_ACCESS:   { status: 403, error: 'Can only access own business users' },
  USER_OWN_BUSINESS_UPDATE:   { status: 403, error: 'Can only update own business users' },
  USER_OWN_BUSINESS_DELETE:   { status: 403, error: 'Can only delete own business users' },

  // ── Specialties ───────────────────────────────────────────────────────────────
  SPECIALTY_CREATE_ONLY:  { status: 403, error: 'Only super_admins can create specialties' },
  SPECIALTY_UPDATE_ONLY:  { status: 403, error: 'Only super_admins can update specialties' },
  SPECIALTY_DELETE_ONLY:  { status: 403, error: 'Only super_admins can delete specialties' },

  // ── Coverage zones ────────────────────────────────────────────────────────────
  ZONE_CREATE_ONLY:       { status: 403, error: 'Only companies and super_admins can create coverage zones' },
  ZONE_UPDATE_OWN:        { status: 403, error: 'Can only update own zones' },
  ZONE_DELETE_OWN:        { status: 403, error: 'Can only delete own zones' },

  // ── Service specialties ───────────────────────────────────────────────────────
  SERVICE_SPECIALTY_MANAGE_ONLY: { status: 403, error: 'Only companies and super_admins can manage service specialties' },

  // ── Technician specialties ────────────────────────────────────────────────────
  TECHNICIAN_SPECIALTY_MANAGE_ONLY:       { status: 403, error: 'Only companies and super_admins can manage technician specialties' },
  TECHNICIAN_SPECIALTY_OWN_VIEW:          { status: 403, error: 'Can only view own specialties' },
  TECHNICIAN_SPECIALTY_OWN_COMPANY:       { status: 403, error: 'Can only manage specialties for technicians in your company' },
  TECHNICIAN_SPECIALTY_VIEW_OWN_COMPANY:  { status: 403, error: 'Can only view specialties for technicians in your company' },

  // ── Technician coverage zones ─────────────────────────────────────────────────
  ZONE_ASSIGN_ONLY_COMPANY:       { status: 403, error: 'Only companies can assign technicians to zones' },
  ZONE_REMOVE_ONLY_COMPANY:       { status: 403, error: 'Only companies can remove zone assignments' },
  ZONE_TECHNICIAN_NOT_OWN:        { status: 403, error: 'Technician does not belong to your company' },
  ZONE_NOT_OWN_COMPANY:           { status: 403, error: 'Coverage zone does not belong to your company' },
  ZONE_ASSIGNMENT_EXISTS:         { status: 409, error: 'Technician is already assigned to this zone' },
  ZONE_ASSIGNMENT_NOT_FOUND:      { status: 404, error: 'Assignment not found' },

  // ── Appointments ──────────────────────────────────────────────────────────────
  APPOINTMENT_CREATE_ONLY:      { status: 403, error: 'Only companies and super_admins can create appointments' },
  APPOINTMENT_UPDATE_ONLY:      { status: 403, error: 'Only companies and super_admins can update appointments' },
  APPOINTMENT_DELETE_ONLY:      { status: 403, error: 'Only companies and super_admins can delete appointments' },
  APPOINTMENT_TECNICO_ONLY:     { status: 403, error: 'Only technicians can update estatus_tecnico' },
  APPOINTMENT_ADMIN_ONLY:       { status: 403, error: 'Only company admins can update estatus_administrador' },
  APPOINTMENT_NO_PERMISSION:    { status: 403, error: 'You do not have permission to update this appointment' },
  APPOINTMENT_PDF_BOTH_STATUSES: { status: 422, error: 'El PDF solo se genera cuando ambos estatus son true' },
  APPOINTMENT_PDF_ERROR:        { status: 500, error: 'Error generating PDF' },
} as const;

export type ErrorKey = keyof typeof Errors;

/**
 * Build a validation error response body (includes Zod field details).
 */
export function validationErrorBody(zodError: ZodError) {
  return {
    ...Errors.VALIDATION_FAILED,
    details: zodError.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
  };
}
