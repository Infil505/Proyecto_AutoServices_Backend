import { Hono } from 'hono';
import { SpecialtyService } from '../services/specialtyService.js';
import { specialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const specialties = await SpecialtyService.getAll();
  return c.json(specialties);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const specialty = await SpecialtyService.getById(id);
  if (!specialty) return c.json({ error: 'Not found' }, 404);
  return c.json(specialty);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only super_admins can create specialties
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can create specialties' }, 403);
  }
  
  const validatedData = specialtySchema.parse(data);
  const specialty = await SpecialtyService.create(validatedData);
  return c.json(specialty, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only super_admins can update specialties
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can update specialties' }, 403);
  }
  
  const validatedData = specialtySchema.partial().parse(data);
  const specialty = await SpecialtyService.update(id, validatedData);
  return c.json(specialty);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  // Only super_admins can delete specialties
  if (payload.type !== 'super_admin') {
    return c.json({ error: 'Only super_admins can delete specialties' }, 403);
  }
  
  await SpecialtyService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;