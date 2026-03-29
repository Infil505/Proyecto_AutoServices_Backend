import { Hono } from 'hono';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';
import { technicianSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') {
    const technician = await TechnicianService.getById(payload.phone);
    return c.json(technician ? [technician] : []);
  }
  if (payload.type === 'company') {
    return c.json(await TechnicianService.getByCompany(payload.phone));
  }
  return c.json(await TechnicianService.getAll());
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
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create technicians' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = technicianSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  // Company admins can only create technicians for their own company
  const companyPhone = payload.type === 'company' ? payload.phone : result.data.companyPhone;
  if (!companyPhone) {
    return c.json({ error: 'companyPhone is required' }, 400);
  }

  try {
    const technician = await TechnicianService.register({
      ...result.data,
      companyPhone,
    });
    return c.json(technician, 201);
  } catch {
    return c.json({ error: 'Phone already registered' }, 409);
  }
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