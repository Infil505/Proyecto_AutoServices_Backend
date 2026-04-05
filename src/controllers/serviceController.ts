import { Hono } from 'hono';
import { ServiceService } from '../services/serviceService.js';
import type { AppContext } from '../types.js';
import { serviceSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const cp = payload.companyPhone;
    if (!cp) return c.json(createPaginatedResponse([], 0, { page, limit, offset, sortOrder: 'desc' }));
    const [data, total] = await Promise.all([ServiceService.getByCompany(cp, { limit, offset }), ServiceService.countByCompany(cp)]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const [data, total] = await Promise.all([ServiceService.getByCompany(payload.phone, { limit, offset }), ServiceService.countByCompany(payload.phone)]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([ServiceService.getAll({ limit, offset }), ServiceService.countAll()]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const service = await ServiceService.getById(id);
  if (!service) return c.json({ error: 'Not found' }, 404);

  if (payload.type === 'company' && service.companyPhone !== payload.phone) return c.json({ error: 'Unauthorized' }, 403);
  if (payload.type === 'technician' && service.companyPhone !== payload.companyPhone) return c.json({ error: 'Unauthorized' }, 403);

  return c.json(service);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create services' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = serviceSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  return c.json(await ServiceService.create(result.data), 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json({ error: 'Unauthorized' }, 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = serviceSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== payload.phone) return c.json({ error: 'Can only update own services' }, 403);
  }

  return c.json(await ServiceService.update(id, result.data));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json({ error: 'Unauthorized' }, 403);
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== payload.phone) return c.json({ error: 'Can only delete own services' }, 403);
  }

  await ServiceService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;
