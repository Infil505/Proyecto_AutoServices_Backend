import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import type { AppContext } from '../types.js';
import { appointmentSchema } from '../validation/schemas.js';

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

export default router;