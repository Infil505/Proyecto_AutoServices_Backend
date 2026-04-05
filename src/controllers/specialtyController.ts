import { Hono } from 'hono';
import { SpecialtyService } from '../services/specialtyService.js';
import { specialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c);
  const [data, total] = await Promise.all([
    SpecialtyService.getAll({ limit, offset }),
    SpecialtyService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const specialty = await SpecialtyService.getById(id);
  if (!specialty) return c.json({ error: 'Not found' }, 404);
  return c.json(specialty);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can create specialties' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = specialtySchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  const specialty = await SpecialtyService.create(result.data);
  return c.json(specialty, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can update specialties' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = specialtySchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }

  const specialty = await SpecialtyService.update(id, result.data);
  return c.json(specialty);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  // Only super_admins can delete specialties
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can delete specialties' }, 403);
  }
  
  await SpecialtyService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;