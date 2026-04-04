import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { PdfService } from '../services/pdfService.js';
import type { AppContext } from '../types.js';
import { appointmentSchema, technicianStatusSchema, adminStatusSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let appts;
  if (payload.type === 'technician') {
    appts = await AppointmentService.getByTechnician(payload.phone);
  } else if (payload.type === 'company') {
    appts = await AppointmentService.getByCompany(payload.phone);
  } else {
    appts = await AppointmentService.getAll();
  }
  return c.json(appts);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);
  
  // Check access
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

  // Only companies and super_admins can delete appointments
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can delete appointments' }, 403);
  }

  await AppointmentService.delete(id);
  return c.json({ message: 'Deleted' });
});

// PATCH /:id/status/tecnico — solo el técnico asignado puede confirmar su finalización
router.patch('/:id/status/tecnico', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'technician') {
    return c.json({ error: 'Solo el tecnico puede actualizar estatus_tecnico' }, 403);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);

  if (appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'No tienes permiso para actualizar esta cita' }, 403);
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

  const updated = await AppointmentService.updateTechnicianStatus(id, result.data.estatusTecnico);
  return c.json(updated);
});

// PATCH /:id/status/administrador — solo el administrador de la compañia asignada puede confirmar
router.patch('/:id/status/administrador', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'company') {
    return c.json({ error: 'Solo el administrador de la compania puede actualizar estatus_administrador' }, 403);
  }

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);

  if (appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'No tienes permiso para actualizar esta cita' }, 403);
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

  const updated = await AppointmentService.updateAdminStatus(id, result.data.estatusAdministrador);
  return c.json(updated);
});

// GET /:id/pdf — genera y descarga el PDF de la cita; requiere que ambos estatus sean true
router.get('/:id/pdf', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);

  // Verificar acceso
  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  if (!appointment.estatusTecnico || !appointment.estatusAdministrador) {
    return c.json({ error: 'El PDF solo se genera cuando ambos estatus (tecnico y administrador) son true' }, 422);
  }

  const fullData = await AppointmentService.getFullById(id);
  if (!fullData) return c.json({ error: 'Not found' }, 404);

  const pdfBuffer = await PdfService.generateAppointmentPdf(fullData);

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cita-${id}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
});

export default router;