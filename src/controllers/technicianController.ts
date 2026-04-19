import { Hono } from 'hono';
import { TechnicianService } from '../services/technicianService.js';
import { AppointmentService } from '../services/appointmentService.js';
import type { AppContext } from '../types.js';
import { technicianSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { handleDbError } from '../utils/dbErrors.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const technician = await TechnicianService.getById(payload.phone);
    return c.json(createPaginatedResponse(technician ? [technician] : [], technician ? 1 : 0, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const [data, total] = await Promise.all([TechnicianService.getByCompany(cp, { limit, offset }), TechnicianService.countByCompany(cp)]);
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
    return c.json(Errors.TECHNICIAN_OWN_AVAILABILITY, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.TECHNICIAN_OWN_COMPANY_ACCESS, 403);
    }
  }

  const technician = await TechnicianService.getById(phone);
  if (!technician) return c.json(Errors.NOT_FOUND, 404);

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
  if (!technician) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && payload.phone !== phone) return c.json(Errors.TECHNICIAN_OWN_DATA, 403);
  if (payload.type === 'company' && technician.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.TECHNICIAN_OWN_COMPANY_ACCESS, 403);

  return c.json(technician);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.TECHNICIAN_CREATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = technicianSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const companyPhone = payload.type === 'company' ? (payload.companyPhone ?? payload.phone) : result.data.companyPhone;
  if (!companyPhone) return c.json(Errors.TECHNICIAN_COMPANY_PHONE_REQUIRED, 400);

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

  if (payload.type === 'technician' && payload.phone !== phone) return c.json(Errors.TECHNICIAN_OWN_UPDATE, 403);
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.TECHNICIAN_OWN_COMPANY_UPDATE, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = technicianSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  if (result.data.available === false) {
    const activeCount = await AppointmentService.countActiveByTechnician(phone);
    if (activeCount > 0) return c.json(Errors.TECHNICIAN_HAS_ACTIVE_APPOINTMENTS, 409);
  }

  return c.json(await TechnicianService.update(phone, result.data));
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && payload.phone !== phone) return c.json(Errors.TECHNICIAN_OWN_DELETE, 403);
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.TECHNICIAN_OWN_COMPANY_DELETE, 403);
  }

  await TechnicianService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;
