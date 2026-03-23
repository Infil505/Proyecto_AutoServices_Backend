import { Hono } from 'hono';
import { ServiceService } from '../services/serviceService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let services;
  if (payload.type === 'technician') {
    // Technicians can only see services from their company
    services = await ServiceService.getAll().then(all => 
      all.filter(s => s.companyPhone === payload.phone)
    );
  } else if (payload.type === 'company') {
    // Companies can see their services
    services = await ServiceService.getAll().then(all => 
      all.filter(s => s.companyPhone === payload.phone)
    );
  } else {
    // super_admin sees all
    services = await ServiceService.getAll();
  }
  return c.json(services);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const service = await ServiceService.getById(id);
  if (!service) return c.json({ error: 'Not found' }, 404);
  
  // Check company access - technicians and companies can only see their company's services
  if ((payload.type === 'technician' || payload.type === 'company') && service.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json(service);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can create services, super_admins can create any
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create services' }, 403);
  }
  
  const service = await ServiceService.create(data);
  return c.json(service, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can update their services, super_admins can update any
  if (payload.type === 'company') {
    const service = await ServiceService.getById(id);
    if (!service || service.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only update own services' }, 403);
    }
  } else if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const service = await ServiceService.update(id, data);
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