import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { PdfService } from '../services/pdfService.js';
import type { AppContext } from '../types.js';
import { appointmentSchema, technicianStatusSchema, adminStatusSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const [data, total] = await Promise.all([
      AppointmentService.getByTechnicianWithDetails(payload.phone, { limit, offset }),
      AppointmentService.countByTechnician(payload.phone),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const [data, total] = await Promise.all([
      AppointmentService.getByCompanyWithDetails(payload.phone, { limit, offset }),
      AppointmentService.countByCompany(payload.phone),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([
    AppointmentService.getAllWithDetails({ limit, offset }),
    AppointmentService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const fullData = await AppointmentService.getFullById(id);
  if (!fullData) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && fullData.appointment.technicianPhone !== payload.phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company' && fullData.appointment.companyPhone !== payload.phone) {
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

  const appointment = await AppointmentService.create(result.data);
  return c.json(appointment, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.APPOINTMENT_UPDATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = appointmentSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const appointment = await AppointmentService.update(id, result.data);
  return c.json(appointment);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.APPOINTMENT_DELETE_ONLY, 403);
  }

  await AppointmentService.delete(id);
  return c.json({ message: 'Deleted' });
});

router.patch('/:id/status/tecnico', async (c) => {
  const id = parseInt(c.req.param('id'));
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
  const id = parseInt(c.req.param('id'));
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
  if (appointment.companyPhone !== payload.phone) {
    return c.json(Errors.APPOINTMENT_NO_PERMISSION, 403);
  }

  return c.json(await AppointmentService.updateAdminStatus(id, result.data.estatusAdministrador));
});

router.get('/:id/pdf', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== payload.phone) {
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
