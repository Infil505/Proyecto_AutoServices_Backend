import { Hono } from 'hono';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let users;
  if (payload.type === 'technician') {
    // Technicians can only see themselves
    users = await UserService.getAll().then(all => 
      all.filter(u => u.phone === payload.phone && u.type === 'technician')
    );
  } else if (payload.type === 'company') {
    // Companies can see users from their business
    users = await UserService.getAll().then(all => 
      all.filter(u => u.phone === payload.phone)
    );
  } else {
    // super_admin sees all
    users = await UserService.getAll();
  }
  return c.json(users);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const user = await UserService.getById(id);
  if (!user) return c.json({ error: 'Not found' }, 404);
  
  // Technicians can access themselves, companies their business users, super_admins any
  if (payload.type === 'technician' && (user.phone !== payload.phone || user.type !== 'technician')) {
    return c.json({ error: 'Can only access own data' }, 403);
  }
  if (payload.type === 'company' && user.phone !== payload.phone) {
    return c.json({ error: 'Can only access own business users' }, 403);
  }
  
  return c.json(user);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only super_admins can create users
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can create users' }, 403);
  }
  
  const user = await UserService.create(data);
  return c.json(user, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const payload = c.var.user!;
  
  const existing = await UserService.getById(id);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  
  // Technicians can update themselves, companies their business users, super_admins any
  if (payload.type === 'technician' && (existing.phone !== payload.phone || existing.type !== 'technician')) {
    return c.json({ error: 'Can only update own data' }, 403);
  }
  if (payload.type === 'company' && existing.phone !== payload.phone) {
    return c.json({ error: 'Can only update own business users' }, 403);
  }
  
  const user = await UserService.update(id, data);
  return c.json(user);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  const existing = await UserService.getById(id);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  
  // Technicians can delete themselves, companies their business users, super_admins any
  if (payload.type === 'technician' && (existing.phone !== payload.phone || existing.type !== 'technician')) {
    return c.json({ error: 'Can only delete own data' }, 403);
  }
  if (payload.type === 'company' && existing.phone !== payload.phone) {
    return c.json({ error: 'Can only delete own business users' }, 403);
  }
  
  await UserService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;