import { Hono } from 'hono';
import { CompanyService } from '../services/companyService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company') {
    const company = await CompanyService.getById(payload.phone);
    return c.json(company ? [company] : []);
  }
  return c.json(await CompanyService.getAll());
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const company = await CompanyService.getById(phone);
  if (!company) return c.json({ error: 'Not found' }, 404);
  
  // Companies can only access their own company
  if (payload.type === 'company' && payload.phone !== phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json(company);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only super_admins can create companies
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can create companies' }, 403);
  }
  
  const company = await CompanyService.create(data);
  return c.json(company, 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can update their own, super_admins can update any
  if (payload.type === 'company' && payload.phone !== phone) {
    return c.json({ error: 'Can only update own company' }, 403);
  }
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const company = await CompanyService.update(phone, data);
  return c.json(company);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  
  // Companies can delete their own, super_admins can delete any
  if (payload.type === 'company' && payload.phone !== phone) {
    return c.json({ error: 'Can only delete own company' }, 403);
  }
  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  await CompanyService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;