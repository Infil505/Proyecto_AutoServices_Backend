import { Hono } from 'hono';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import type { AppContext } from '../types.js';
import { coverageZoneSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') {
    const companyPhone = payload.companyPhone;
    if (!companyPhone) return c.json([]);
    return c.json(await CoverageZoneService.getByCompany(companyPhone));
  }
  if (payload.type === 'company') {
    return c.json(await CoverageZoneService.getByCompany(payload.phone));
  }
  return c.json(await CoverageZoneService.getAll());
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const zone = await CoverageZoneService.getById(id);
  if (!zone) return c.json({ error: 'Not found' }, 404);
  
  // Check company access
  if (payload.type === 'company' && zone.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'technician' && zone.companyPhone !== payload.companyPhone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json(zone);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create coverage zones' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = coverageZoneSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const zone = await CoverageZoneService.create(result.data);
  return c.json(zone, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only update own zones' }, 403);
    }
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = coverageZoneSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const zone = await CoverageZoneService.update(id, result.data);
  return c.json(zone);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  // Companies can delete their zones, super_admins can delete any
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only delete own zones' }, 403);
    }
  } else if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  await CoverageZoneService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;