import { Hono } from 'hono';
import { ServiceService } from '../services/serviceService.js';
import type { AppContext } from '../types.js';
import { serviceSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';

const SERVICES_TTL = 60_000;

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const cp = payload.companyPhone;
    if (!cp) return c.json(createPaginatedResponse([], 0, { page, limit, offset, sortOrder: 'desc' }));
    const cacheKey = `services:co:${cp}:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([ServiceService.getByCompany(cp, { limit, offset }), ServiceService.countByCompany(cp)]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, SERVICES_TTL);
    return c.json(result);
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const cacheKey = `services:co:${cp}:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([ServiceService.getByCompany(cp, { limit, offset }), ServiceService.countByCompany(cp)]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, SERVICES_TTL);
    return c.json(result);
  }
  const cacheKey = `services:admin:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);
  const [data, total] = await Promise.all([ServiceService.getAll({ limit, offset }), ServiceService.countAll()]);
  const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, result, SERVICES_TTL);
  return c.json(result);
});

router.get('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;
  const service = await ServiceService.getById(id);
  if (!service) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'company' && service.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'technician' && service.companyPhone !== payload.companyPhone) return c.json(Errors.UNAUTHORIZED, 403);

  return c.json(service);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.SERVICE_CREATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = serviceSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const companyPhone = payload.type === 'company'
    ? (payload.companyPhone ?? payload.phone)
    : result.data.companyPhone;
  if (!companyPhone) return c.json({ error: 'companyPhone is required' }, 400);

  const service = await ServiceService.create({ ...result.data, companyPhone });
  cacheDeletePrefix('services:');
  return c.json(service, 201);
});

router.put('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);

  // Ownership check before body parsing — avoids leaking whether an ID exists
  // to callers who don't own the resource (400 vs 403/404 timing oracle).
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.SERVICE_UPDATE_OWN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = serviceSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const { companyPhone: _stripped, ...updateWithoutCompanyPhone } = result.data;
  const dataToUpdate = payload.type === 'super_admin' ? result.data : updateWithoutCompanyPhone;
  const updated = await ServiceService.update(id, dataToUpdate);
  if (!updated) return c.json(Errors.NOT_FOUND, 404);
  cacheDeletePrefix('services:');
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.SERVICE_DELETE_OWN, 403);
  }

  await ServiceService.delete(id);
  cacheDeletePrefix('services:');
  return c.json({ message: 'Deleted' });
});

export default router;
