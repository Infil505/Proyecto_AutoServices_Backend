import { Hono } from 'hono';
import { TechnicianService } from '../services/technicianService.js';
import { AppointmentService } from '../services/appointmentService.js';
import type { AppContext } from '../types.js';
import { technicianSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { handleDbError } from '../utils/dbErrors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const technician = await TechnicianService.getById(payload.phone);
    return c.json(createPaginatedResponse(technician ? [technician] : [], technician ? 1 : 0, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const [data, total] = await Promise.all([TechnicianService.getByCompany(payload.phone, { limit, offset }), TechnicianService.countByCompany(payload.phone)]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([TechnicianService.getAll({ limit, offset }), TechnicianService.countAll()]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:phone/availability', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  const date = c.req.query('date'); // optional: YYYY-MM-DD

  if (payload.type === 'technician' && payload.phone !== phone) {
    return c.json({ error: 'Can only access own availability' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only access own technicians' }, 403);
    }
  }

  const technician = await TechnicianService.getById(phone);
  if (!technician) return c.json({ error: 'Not found' }, 404);

  const occupied = date
    ? await AppointmentService.getByTechnicianAndDate(phone, date)
    : [];

  return c.json({
    technicianPhone: phone,
    available: technician.available ?? true,
    date: date ?? null,
    occupiedSlots: occupied.map(a => ({
      appointmentId: a.id,
      startTime: a.startTime,
      status: a.status,
    })),
  });
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  const technician = await TechnicianService.getById(phone);
  if (!technician) return c.json({ error: 'Not found' }, 404);

  if (payload.type === 'technician' && payload.phone !== phone) return c.json({ error: 'Can only access own data' }, 403);
  if (payload.type === 'company' && technician.companyPhone !== payload.phone) return c.json({ error: 'Can only access own technicians' }, 403);

  return c.json(technician);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create technicians' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = technicianSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  const companyPhone = payload.type === 'company' ? payload.phone : result.data.companyPhone;
  if (!companyPhone) return c.json({ error: 'companyPhone is required' }, 400);

  try {
    return c.json(await TechnicianService.register({ ...result.data, companyPhone }), 201);
  } catch (err) {
    const mapped = handleDbError(err);
    return c.json({ error: mapped.error }, mapped.status as any);
  }
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && payload.phone !== phone) return c.json({ error: 'Can only update own data' }, 403);
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) return c.json({ error: 'Can only update own technicians' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = technicianSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }
  return c.json(await TechnicianService.update(phone, result.data));
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && payload.phone !== phone) return c.json({ error: 'Can only delete own data' }, 403);
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) return c.json({ error: 'Can only delete own technicians' }, 403);
  }

  await TechnicianService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;
