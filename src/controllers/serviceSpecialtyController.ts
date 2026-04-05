import { Hono } from 'hono';
import { ServiceSpecialtyService } from '../services/serviceSpecialtyService.js';
import { serviceSpecialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';

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
  const serviceId = parseInt(c.req.param('serviceId'));
  const serviceSpecialties = await ServiceSpecialtyService.getByServiceId(serviceId);
  return c.json(serviceSpecialties);
});

router.get('/specialty/:specialtyId', async (c) => {
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const serviceSpecialties = await ServiceSpecialtyService.getBySpecialtyId(specialtyId);
  return c.json(serviceSpecialties);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage service specialties' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = serviceSpecialtySchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  const serviceSpecialty = await ServiceSpecialtyService.create(result.data);
  return c.json(serviceSpecialty, 201);
});

router.delete('/:serviceId/:specialtyId', async (c) => {
  const serviceId = parseInt(c.req.param('serviceId'));
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const payload = c.var.user!;
  
  // Only companies and super_admins can manage service specialties
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage service specialties' }, 403);
  }
  
  await ServiceSpecialtyService.delete(serviceId, specialtyId);
  return c.json({ message: 'Deleted' });
});

export default router;