import { Hono } from 'hono';
import { CustomerService } from '../services/customerService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  // Only companies and super_admins can see customers
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  const customers = await CustomerService.getAll();
  return c.json(customers);
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  // Only companies and super_admins can access customers
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  const customer = await CustomerService.getById(phone);
  if (!customer) return c.json({ error: 'Not found' }, 404);
  return c.json(customer);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only companies and super_admins can create customers
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create customers' }, 403);
  }
  
  const customer = await CustomerService.create(data);
  return c.json(customer, 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only companies and super_admins can update customers
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can update customers' }, 403);
  }
  
  const customer = await CustomerService.update(phone, data);
  return c.json(customer);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  
  // Only companies and super_admins can delete customers
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can delete customers' }, 403);
  }
  
  await CustomerService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;