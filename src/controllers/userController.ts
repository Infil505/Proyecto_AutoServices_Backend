import { Hono } from 'hono';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';
import { userSchema } from '../validation/schemas.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician' || payload.type === 'company') {
    const user = await UserService.getByPhone(payload.phone);
    return c.json(user ? [user] : []);
  }
  return c.json(await UserService.getAll());
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const user = await UserService.getById(id);
  if (!user) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && (user.phone !== payload.phone || user.type !== 'technician')) {
    return c.json(Errors.USER_OWN_DATA, 403);
  }
  if (payload.type === 'company' && user.phone !== payload.phone) {
    return c.json(Errors.USER_OWN_BUSINESS_ACCESS, 403);
  }

  return c.json(user);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json(Errors.USER_CREATE_ONLY_ADMIN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = userSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const { password, ...rest } = result.data;
  const user = await UserService.create({ ...rest, passwordHash: password });
  return c.json(user, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  const existing = await UserService.getById(id);
  if (!existing) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && (existing.phone !== payload.phone || existing.type !== 'technician')) {
    return c.json(Errors.USER_OWN_UPDATE, 403);
  }
  if (payload.type === 'company' && existing.phone !== payload.phone) {
    return c.json(Errors.USER_OWN_BUSINESS_UPDATE, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = userSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const { password, ...rest } = result.data;
  const user = await UserService.update(id, { ...rest, ...(password ? { passwordHash: password } : {}) });
  return c.json(user);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  const existing = await UserService.getById(id);
  if (!existing) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'technician' && (existing.phone !== payload.phone || existing.type !== 'technician')) {
    return c.json(Errors.USER_OWN_DELETE, 403);
  }
  if (payload.type === 'company' && existing.phone !== payload.phone) {
    return c.json(Errors.USER_OWN_BUSINESS_DELETE, 403);
  }

  await UserService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;
