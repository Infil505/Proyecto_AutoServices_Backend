import { Hono } from 'hono';
import { ServiceSpecialtyService } from '../services/serviceSpecialtyService.js';
import { serviceSpecialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c);
  const [data, total] = await Promise.all([
    ServiceSpecialtyService.getAll({ limit, offset }),
    ServiceSpecialtyService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/service/:serviceId', async (c) => {
  const serviceId = parseIntParam(c.req.param('serviceId'));
  if (!serviceId) return c.json(Errors.NOT_FOUND, 404);
  const serviceSpecialties = await ServiceSpecialtyService.getByServiceId(serviceId);
  return c.json(serviceSpecialties);
});

router.get('/specialty/:specialtyId', async (c) => {
  const specialtyId = parseIntParam(c.req.param('specialtyId'));
  if (!specialtyId) return c.json(Errors.NOT_FOUND, 404);
  const serviceSpecialties = await ServiceSpecialtyService.getBySpecialtyId(specialtyId);
  return c.json(serviceSpecialties);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.SERVICE_SPECIALTY_MANAGE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = serviceSpecialtySchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const serviceSpecialty = await ServiceSpecialtyService.create(result.data);
  return c.json(serviceSpecialty, 201);
});

router.delete('/:serviceId/:specialtyId', async (c) => {
  const serviceId = parseIntParam(c.req.param('serviceId'));
  const specialtyId = parseIntParam(c.req.param('specialtyId'));
  if (!serviceId || !specialtyId) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.SERVICE_SPECIALTY_MANAGE_ONLY, 403);
  }

  await ServiceSpecialtyService.delete(serviceId, specialtyId);
  return c.json({ message: 'Deleted' });
});

export default router;
