import { Hono } from 'hono';
import { CompanyService } from '../services/companyService.js';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';
import { adminRegisterSchema, companyRegisterSchema, loginSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

/**
 * POST /api/auth/register/company
 * Public. Creates a company record and its admin user in a single transaction.
 */
router.post('/register/company', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = companyRegisterSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  try {
    const company = await CompanyService.register(result.data);
    return c.json({ company }, 201);
  } catch {
    return c.json({ error: 'Phone already registered' }, 409);
  }
});

/**
 * POST /api/auth/register/admin
 * Protected — only super_admin can create another super_admin.
 */
router.post('/register/admin', async (c) => {
  const user = c.var.user;
  if (!user || user.type !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = adminRegisterSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const { phone, name, email, password } = result.data;
  try {
    const admin = await UserService.create({ type: 'super_admin', phone, name, email, passwordHash: password });
    return c.json({ user: admin }, 201);
  } catch {
    return c.json({ error: 'Phone already registered' }, 409);
  }
});

/**
 * POST /api/auth/login
 * Public. Returns a JWT on valid credentials.
 */
router.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const auth = await UserService.authenticate(result.data.phone, result.data.password);
  if (!auth) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({ user: auth.user, token: auth.token });
});

export default router;
