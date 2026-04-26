import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { CalendarService, type CalendarEventInput } from '../services/calendarService.js';
import { EmailService } from '../services/emailService.js';
import { PdfService } from '../services/pdfService.js';
import type { AppContext } from '../types.js';
import { appointmentSchema, technicianStatusSchema, adminStatusSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';
import logger from '../utils/logger.js';

const APPOINTMENTS_LIST_TTL = 60_000; // 60s — WS invalidates cache on mutations, so 5s was unnecessary churn

function safeMeta(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

async function syncCalendarAsync(
  appointmentId: number,
  appointment: { appointmentDate: string | null; startTime: string | null; metadata: unknown },
  mode: 'create' | 'update',
  prevTechnicianPhone?: string | null,
): Promise<void> {
  if (!appointment.appointmentDate || !appointment.startTime) return;
  const full = await AppointmentService.getFullById(appointmentId);
  if (!full) return;

  const meta = safeMeta(appointment.metadata);
  const existingEventId = meta.calendarEventId as string | undefined;
  const calResult = mode === 'update' && existingEventId
    ? await CalendarService.updateEvent(existingEventId, buildCalendarInput(full))
    : await CalendarService.createEvent(buildCalendarInput(full));

  let calendarLink: string | undefined;
  if (calResult) {
    await AppointmentService.update(appointmentId, {
      content: calResult.htmlLink,
      metadata: { ...meta, calendarEventId: calResult.eventId },
    }, full.appointment);
    calendarLink = calResult.htmlLink;
  }

  if (mode === 'create') {
    try {
      await EmailService.sendAppointmentCreatedEmails(full, calendarLink);
    } catch (err) {
      logger.warn(`[syncCalendarAsync] Email notifications failed for appointment ${appointmentId}: ${err}`);
    }
  } else {
    // Send email to technician only when newly assigned or reassigned
    const newTechPhone = full.appointment.technicianPhone;
    const techChanged = !!newTechPhone && newTechPhone !== (prevTechnicianPhone ?? null);
    if (techChanged && full.technician?.email) {
      try {
        await EmailService.sendTechnicianAssignedEmail(full, calendarLink);
      } catch (err) {
        logger.warn(`[syncCalendarAsync] Tech assignment email failed for appointment ${appointmentId}: ${err}`);
      }
    }
  }
}

function buildCalendarInput(
  full: NonNullable<Awaited<ReturnType<typeof AppointmentService.getFullById>>>
): CalendarEventInput {
  const { appointment, customer, technician, service, company } = full;
  const clientName = customer?.name ?? appointment.customerPhone ?? 'Cliente';
  const techName = technician?.name ?? '';
  const duration = service?.estimatedDurationMinutes ?? 60;

  const attendees: string[] = [];
  if (customer?.email) attendees.push(customer.email);
  if (technician?.email) attendees.push(technician.email);
  if (company?.email) attendees.push(company.email);

  const descLines: string[] = [];
  if (appointment.description) descLines.push(appointment.description);
  if (service?.name) descLines.push(`Servicio: ${service.name}`);
  if (techName) descLines.push(`Técnico: ${techName}`);
  if (appointment.customerPhone) descLines.push(`Tel cliente: ${appointment.customerPhone}`);
  if (company?.name) descLines.push(`Empresa: ${company.name}`);

  const coords = appointment.coordinates as { lat?: number; lng?: number } | null;
  const location = coords?.lat && coords?.lng ? `${coords.lat},${coords.lng}` : undefined;

  return {
    title: `Cita - ${clientName}${techName ? ` | ${techName}` : ''}`,
    description: descLines.join('\n'),
    date: appointment.appointmentDate!,
    startTime: appointment.startTime!,
    durationMinutes: duration,
    location,
    attendeeEmails: attendees.length ? attendees : undefined,
  };
}

export function invalidateAppointmentsCache(companyPhone?: string): void {
  if (companyPhone) {
    cacheDeletePrefix(`appointments:co:${companyPhone}:`);
  } else {
    cacheDeletePrefix('appointments:');
  }
}

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const cacheKey = `appointments:tech:${payload.phone}:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([
      AppointmentService.getByTechnicianWithDetails(payload.phone, { limit, offset }),
      AppointmentService.countByTechnician(payload.phone),
    ]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, APPOINTMENTS_LIST_TTL);
    return c.json(result);
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const cacheKey = `appointments:co:${cp}:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([
      AppointmentService.getByCompanyWithDetails(cp, { limit, offset }),
      AppointmentService.countByCompany(cp),
    ]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, APPOINTMENTS_LIST_TTL);
    return c.json(result);
  }
  const cacheKey = `appointments:admin:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);
  const [data, total] = await Promise.all([
    AppointmentService.getAllWithDetails({ limit, offset }),
    AppointmentService.countAll(),
  ]);
  const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, result, APPOINTMENTS_LIST_TTL);
  return c.json(result);
});

router.get('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;
  const fullData = await AppointmentService.getFullById(id);
  if (!fullData) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && fullData.appointment.technicianPhone !== payload.phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company' && fullData.appointment.companyPhone !== (payload.companyPhone ?? payload.phone)) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }

  return c.json(fullData.appointment);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.APPOINTMENT_CREATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = appointmentSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  // For company role: always use companyPhone from JWT, ignore body value
  // For super_admin: companyPhone must be provided in body
  const companyPhone = payload.type === 'company'
    ? (payload.companyPhone ?? payload.phone)
    : result.data.companyPhone;

  if (!companyPhone) return c.json({ error: 'companyPhone is required' }, 400);

  const appointment = await AppointmentService.create({ ...result.data, companyPhone });
  if (!appointment) return c.json(Errors.NOT_FOUND, 500);
  invalidateAppointmentsCache(appointment.companyPhone ?? undefined);
  void syncCalendarAsync(appointment.id, appointment, 'create');
  return c.json(appointment, 201);
});

router.put('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.APPOINTMENT_UPDATE_ONLY, 403);
  }

  const existing = await AppointmentService.getById(id);
  if (!existing) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'company' && existing.companyPhone !== (payload.companyPhone ?? payload.phone)) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = appointmentSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const prevTechPhone = existing.technicianPhone;
  const appointment = await AppointmentService.update(id, result.data, existing);
  if (!appointment) return c.json(Errors.NOT_FOUND, 404);
  invalidateAppointmentsCache(appointment.companyPhone ?? undefined);
  void syncCalendarAsync(appointment.id, appointment, 'update', prevTechPhone);
  return c.json(appointment);
});

router.delete('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.APPOINTMENT_DELETE_ONLY, 403);
  }

  let existingForDelete: Awaited<ReturnType<typeof AppointmentService.getById>> | undefined;
  if (payload.type === 'company') {
    existingForDelete = await AppointmentService.getById(id);
    if (!existingForDelete) return c.json(Errors.NOT_FOUND, 404);
    if (existingForDelete.companyPhone !== (payload.companyPhone ?? payload.phone))
      return c.json(Errors.UNAUTHORIZED, 403);
  }

  const companyPhone = existingForDelete?.companyPhone;
  const deleteEventId = safeMeta(existingForDelete?.metadata).calendarEventId as string | undefined;

  await AppointmentService.delete(id, existingForDelete ?? undefined);
  invalidateAppointmentsCache(companyPhone ?? undefined);
  if (deleteEventId) void CalendarService.deleteEvent(deleteEventId);
  return c.json({ message: 'Deleted' });
});

router.patch('/:id/status/tecnico', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'technician') {
    return c.json(Errors.APPOINTMENT_TECNICO_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = technicianStatusSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json(Errors.NOT_FOUND, 404);
  if (appointment.technicianPhone !== payload.phone) {
    return c.json(Errors.APPOINTMENT_NO_PERMISSION, 403);
  }

  return c.json(await AppointmentService.updateTechnicianStatus(id, result.data.estatusTecnico));
});

router.patch('/:id/status/administrador', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'company') {
    return c.json(Errors.APPOINTMENT_ADMIN_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = adminStatusSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json(Errors.NOT_FOUND, 404);
  if (appointment.companyPhone !== (payload.companyPhone ?? payload.phone)) {
    return c.json(Errors.APPOINTMENT_NO_PERMISSION, 403);
  }

  return c.json(await AppointmentService.updateAdminStatus(id, result.data.estatusAdministrador));
});

router.get('/:id/pdf', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== (payload.companyPhone ?? payload.phone)) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (!appointment.estatusTecnico || !appointment.estatusAdministrador) {
    return c.json(Errors.APPOINTMENT_PDF_BOTH_STATUSES, 422);
  }

  const fullData = await AppointmentService.getFullById(id);
  if (!fullData) return c.json(Errors.NOT_FOUND, 404);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await PdfService.generateAppointmentPdf(fullData);
  } catch {
    return c.json(Errors.APPOINTMENT_PDF_ERROR, 500);
  }

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cita-${id}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
});

export default router;
