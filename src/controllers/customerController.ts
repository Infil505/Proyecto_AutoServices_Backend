import { Hono } from 'hono';
import { CustomerService } from '../services/customerService.js';
import type { AppContext } from '../types.js';
import { customerSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') return c.json({ error: 'Unauthorized' }, 403);

  const { page, limit, offset } = parsePagination(c);
  const [data, total] = await Promise.all([
    CustomerService.getAll({ limit, offset }),
    CustomerService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type === 'technician') return c.json({ error: 'Unauthorized' }, 403);
  const customer = await CustomerService.getById(phone);
  if (!customer) return c.json({ error: 'Not found' }, 404);
  return c.json(customer);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create customers' }, 403);
  }
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = customerSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }
  return c.json(await CustomerService.create(result.data), 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can update customers' }, 403);
  }
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const result = customerSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }
  return c.json(await CustomerService.update(phone, result.data));
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can delete customers' }, 403);
  }
  await CustomerService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;
