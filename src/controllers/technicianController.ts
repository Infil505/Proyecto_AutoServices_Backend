import { Hono } from 'hono';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let technicians;
  if (payload.type === 'technician') {
    // Technicians can only see themselves
    technicians = await TechnicianService.getAll().then(all => 
      all.filter(t => t.phone === payload.phone)
    );
  } else if (payload.type === 'company') {
    // Companies can see their technicians
    technicians = await TechnicianService.getAll().then(all => 
      all.filter(t => t.companyPhone === payload.phone)
    );
  } else {
    // super_admin sees all
    technicians = await TechnicianService.getAll();
  }
  return c.json(technicians);
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  const technician = await TechnicianService.getById(phone);
  if (!technician) return c.json({ error: 'Not found' }, 404);
  
  // Technicians can access themselves, companies their technicians, super_admins any
  if (payload.type === 'technician' && payload.phone !== phone) {
    return c.json({ error: 'Can only access own data' }, 403);
  }
  if (payload.type === 'company' && technician.companyPhone !== payload.phone) {
    return c.json({ error: 'Can only access own technicians' }, 403);
  }
  
  return c.json(technician);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Companies can create technicians, super_admins can create any
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create technicians' }, 403);
  }
  
  const technician = await TechnicianService.create(data);
  return c.json(technician, 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Technicians can update themselves, companies their technicians, super_admins any
  if (payload.type === 'technician' && payload.phone !== phone) {
    return c.json({ error: 'Can only update own data' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only update own technicians' }, 403);
    }
  }
  
  const technician = await TechnicianService.update(phone, data);
  return c.json(technician);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  
  // Technicians can delete themselves, companies their technicians, super_admins any
  if (payload.type === 'technician' && payload.phone !== phone) {
    return c.json({ error: 'Can only delete own data' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only delete own technicians' }, 403);
    }
  }
  
  await TechnicianService.delete(phone);
  return c.json({ message: 'Deleted' });
});

export default router;