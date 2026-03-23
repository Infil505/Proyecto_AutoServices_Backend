import { Hono } from 'hono';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let zones;
  if (payload.type === 'technician') {
    // Technicians can only see zones from their company
    zones = await CoverageZoneService.getAll().then(all => 
      all.filter(z => z.companyPhone === payload.phone)
    );
  } else if (payload.type === 'company') {
    // Companies can see their zones
    zones = await CoverageZoneService.getAll().then(all => 
      all.filter(z => z.companyPhone === payload.phone)
    );
  } else {
    // super_admin sees all
    zones = await CoverageZoneService.getAll();
  }
  return c.json(zones);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const zone = await CoverageZoneService.getById(id);
  if (!zone) return c.json({ error: 'Not found' }, 404);
  
  // Check company access - technicians and companies can only see their company's zones
  if ((payload.type === 'technician' || payload.type === 'company') && zone.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json(zone);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can create zones, super_admins can create any
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create coverage zones' }, 403);
  }
  
  const zone = await CoverageZoneService.create(data);
  return c.json(zone, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can update their zones, super_admins can update any
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only update own zones' }, 403);
    }
  } else if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const zone = await CoverageZoneService.update(id, data);
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