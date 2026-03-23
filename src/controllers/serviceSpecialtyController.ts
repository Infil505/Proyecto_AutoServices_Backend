import { Hono } from 'hono';
import { ServiceSpecialtyService } from '../services/serviceSpecialtyService.js';
import { serviceSpecialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const serviceSpecialties = await ServiceSpecialtyService.getAll();
  return c.json(serviceSpecialties);
});

router.get('/service/:serviceId', async (c) => {
  const serviceId = parseInt(c.req.param('serviceId'));
  const serviceSpecialties = await ServiceSpecialtyService.getByServiceId(serviceId);
  return c.json(serviceSpecialties);
});

router.get('/specialty/:specialtyId', async (c) => {
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const serviceSpecialties = await ServiceSpecialtyService.getBySpecialtyId(specialtyId);
  return c.json(serviceSpecialties);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only companies and super_admins can manage service specialties
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage service specialties' }, 403);
  }
  
  const validatedData = serviceSpecialtySchema.parse(data);
  const serviceSpecialty = await ServiceSpecialtyService.create(validatedData);
  return c.json(serviceSpecialty, 201);
});

router.delete('/:serviceId/:specialtyId', async (c) => {
  const serviceId = parseInt(c.req.param('serviceId'));
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const payload = c.var.user!;
  
  // Only companies and super_admins can manage service specialties
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage service specialties' }, 403);
  }
  
  await ServiceSpecialtyService.delete(serviceId, specialtyId);
  return c.json({ message: 'Deleted' });
});

export default router;