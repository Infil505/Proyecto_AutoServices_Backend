import { Hono } from 'hono';
import { CustomerService } from '../services/customerService.js';
import type { AppContext } from '../types.js';
import { customerSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';

const CUSTOMERS_TTL = 30_000;

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);

  const { page, limit, offset } = parsePagination(c);
  const cacheKey = `customers:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);

  const [data, total] = await Promise.all([
    CustomerService.getAll({ limit, offset }),
    CustomerService.countAll(),
  ]);
  const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, result, CUSTOMERS_TTL);
  return c.json(result);
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  const customer = await CustomerService.getById(phone);
  if (!customer) return c.json(Errors.NOT_FOUND, 404);
  return c.json(customer);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.CUSTOMER_CREATE_ONLY, 403);
  }
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = customerSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }
  const customer = await CustomerService.create(result.data);
  cacheDeletePrefix('customers:');
  return c.json(customer, 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.CUSTOMER_UPDATE_ONLY, 403);
  }
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = customerSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }
  const updated = await CustomerService.update(phone, result.data);
  if (!updated) return c.json(Errors.NOT_FOUND, 404);
  cacheDeletePrefix('customers:');
  return c.json(updated);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.CUSTOMER_DELETE_ONLY, 403);
  }
  await CustomerService.delete(phone);
  cacheDeletePrefix('customers:');
  return c.json({ message: 'Deleted' });
});

export default router;
