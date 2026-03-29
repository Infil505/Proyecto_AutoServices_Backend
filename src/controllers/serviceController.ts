import { Hono } from 'hono';
import { ServiceService } from '../services/serviceService.js';
import type { AppContext } from '../types.js';
import { serviceSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') {
    const companyPhone = payload.companyPhone;
    if (!companyPhone) return c.json([]);
    return c.json(await ServiceService.getByCompany(companyPhone));
  }
  if (payload.type === 'company') {
    return c.json(await ServiceService.getByCompany(payload.phone));
  }
  return c.json(await ServiceService.getAll());
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const service = await ServiceService.getById(id);
  if (!service) return c.json({ error: 'Not found' }, 404);
  
  // Check company access
  if (payload.type === 'company' && service.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'technician' && service.companyPhone !== payload.companyPhone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
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
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const service = await ServiceService.create(result.data);
  return c.json(service, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only update own services' }, 403);
    }
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = serviceSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const service = await ServiceService.update(id, result.data);
  return c.json(service);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  // Companies can delete their services, super_admins can delete any
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only delete own services' }, 403);
    }
  } else if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  await ServiceService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;