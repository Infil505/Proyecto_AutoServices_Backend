import { Hono } from 'hono';
import { TechnicianService } from '../services/technicianService.js';
import { AppointmentService } from '../services/appointmentService.js';
import type { AppContext } from '../types.js';
import { technicianSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { handleDbError } from '../utils/dbErrors.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';
import logger from '../utils/logger.js';

const TECHNICIANS_LIST_TTL = 60_000;

function invalidateTechniciansCache(companyPhone?: string): void {
  if (companyPhone) {
    cacheDeletePrefix(`technicians:co:${companyPhone}:`);
  } else {
    cacheDeletePrefix('technicians:');
  }
}

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const cacheKey = `technicians:tech:${payload.phone}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const technician = await TechnicianService.getById(payload.phone);
    const result = createPaginatedResponse(technician ? [technician] : [], technician ? 1 : 0, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, TECHNICIANS_LIST_TTL);
    return c.json(result);
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const cacheKey = `technicians:co:${cp}:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([TechnicianService.getByCompany(cp, { limit, offset }), TechnicianService.countByCompany(cp)]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, TECHNICIANS_LIST_TTL);
    return c.json(result);
  }
  const cacheKey = `technicians:admin:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);
  const [data, total] = await Promise.all([TechnicianService.getAll({ limit, offset }), TechnicianService.countAll()]);
  const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, result, TECHNICIANS_LIST_TTL);
  return c.json(result);
});

router.get('/:phone/availability', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  const date = c.req.query('date'); // optional: YYYY-MM-DD

  if (payload.type === 'technician' && payload.phone !== phone) {
    return c.json(Errors.TECHNICIAN_OWN_AVAILABILITY, 403);
  }

  // Single query — reused for both permission check and response
  const technician = await TechnicianService.getById(phone);
  if (!technician) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'company' && technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
    return c.json(Errors.TECHNICIAN_OWN_COMPANY_ACCESS, 403);
  }

  const availCacheKey = `availability:${phone}:${date ?? 'all'}`;
  const cachedSlots = cacheGet<Array<{ appointmentId: number; startTime: string | null; status: string | null }>>(availCacheKey);

  const occupiedSlots = cachedSlots ?? await (async () => {
    if (!date) return [];
    const rows = await AppointmentService.getByTechnicianAndDate(phone, date);
    const slots = rows.map(a => ({ appointmentId: a.id, startTime: a.startTime, status: a.status }));
    cacheSet(availCacheKey, slots, 60_000);
    return slots;
  })();

  return c.json({
    technicianPhone: phone,
    available: technician.available ?? true,
    date: date ?? null,
    occupiedSlots,
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

  const alreadyExists = await TechnicianService.getById(result.data.phone);
  if (alreadyExists) return c.json(Errors.DB_UNIQUE_VIOLATION, 409);

  try {
    const { technician, setupToken } = await TechnicianService.register({ ...result.data, companyPhone });
    invalidateTechniciansCache(companyPhone);
    return c.json({ technician, setupToken }, 201);
  } catch (err) {
    const mapped = handleDbError(err);
    logger.error(`POST /technicians register failed for ${result.data.phone} (company ${companyPhone}): ${String(err)}`);
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

  const { companyPhone: _stripped, ...updateWithoutCompanyPhone } = result.data;
  const dataToUpdate = payload.type === 'super_admin' ? result.data : updateWithoutCompanyPhone;
  const updated = await TechnicianService.update(phone, dataToUpdate);
  if (!updated) return c.json(Errors.NOT_FOUND, 404);
  invalidateTechniciansCache(updated.companyPhone ?? undefined);
  return c.json(updated);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && payload.phone !== phone) return c.json(Errors.TECHNICIAN_OWN_DELETE, 403);
  let techForDelete: Awaited<ReturnType<typeof TechnicianService.getById>> | undefined;
  if (payload.type === 'company') {
    techForDelete = await TechnicianService.getById(phone);
    if (!techForDelete || techForDelete.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.TECHNICIAN_OWN_COMPANY_DELETE, 403);
  }

  await TechnicianService.delete(phone);
  invalidateTechniciansCache(techForDelete?.companyPhone ?? undefined);
  return c.json({ message: 'Deleted' });
});

export default router;
