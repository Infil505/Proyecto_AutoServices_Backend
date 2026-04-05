import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { PdfService } from '../services/pdfService.js';
import type { AppContext } from '../types.js';
import { appointmentSchema, technicianStatusSchema, adminStatusSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const [data, total] = await Promise.all([
      AppointmentService.getByTechnician(payload.phone, { limit, offset }),
      AppointmentService.countByTechnician(payload.phone),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const [data, total] = await Promise.all([
      AppointmentService.getByCompany(payload.phone, { limit, offset }),
      AppointmentService.countByCompany(payload.phone),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([
    AppointmentService.getAll({ limit, offset }),
    AppointmentService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);

  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  return c.json(appointment);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create appointments' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = appointmentSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const appointment = await AppointmentService.create(result.data);
  return c.json(appointment, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can update appointments' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = appointmentSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const appointment = await AppointmentService.update(id, result.data);
  return c.json(appointment);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can delete appointments' }, 403);
  }

  await AppointmentService.delete(id);
  return c.json({ message: 'Deleted' });
});

router.patch('/:id/status/tecnico', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'technician') {
    return c.json({ error: 'Only technicians can update estatus_tecnico' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = technicianStatusSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);
  if (appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'You do not have permission to update this appointment' }, 403);
  }

  return c.json(await AppointmentService.updateTechnicianStatus(id, result.data.estatusTecnico));
});

router.patch('/:id/status/administrador', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company') {
    return c.json({ error: 'Only company admins can update estatus_administrador' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = adminStatusSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);
  if (appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'You do not have permission to update this appointment' }, 403);
  }

  return c.json(await AppointmentService.updateAdminStatus(id, result.data.estatusAdministrador));
});

router.get('/:id/pdf', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);

  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (!appointment.estatusTecnico || !appointment.estatusAdministrador) {
    return c.json({ error: 'El PDF solo se genera cuando ambos estatus son true' }, 422);
  }

  const fullData = await AppointmentService.getFullById(id);
  if (!fullData) return c.json({ error: 'Not found' }, 404);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await PdfService.generateAppointmentPdf(fullData);
  } catch {
    return c.json({ error: 'Error generating PDF' }, 500);
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
