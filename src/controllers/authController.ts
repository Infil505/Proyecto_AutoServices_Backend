import { Hono } from 'hono';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.post('/register', async (c) => {
  const { type, phone, name, email, password } = await c.req.json();

  if (!type || !phone || !name || !password) {
    return c.json({ error: 'Type, phone, name, and password are required' }, 400);
  }

  if (!['technician', 'company', 'super_admin'].includes(type)) {
    return c.json({ error: 'Invalid user type' }, 400);
  }

  try {
    const user = await UserService.create({
      type,
      phone,
      name,
      email,
      passwordHash: password, // Will be hashed in service
    });
    return c.json({ user }, 201);
  } catch (error) {
    return c.json({ error: 'User already exists or invalid data' }, 400);
  }
});

router.post('/login', async (c) => {
  const { phone, password } = await c.req.json();

  if (!phone || !password) {
    return c.json({ error: 'Phone and password required' }, 400);
  }

  const auth = await UserService.authenticate(phone, password);
  if (!auth) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({ user: auth.user, token: auth.token });
});

export default router;