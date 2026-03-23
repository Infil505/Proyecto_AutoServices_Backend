import { Hono } from 'hono';
import { TechnicianSpecialtyService } from '../services/technicianSpecialtyService.js';
import { TechnicianService } from '../services/technicianService.js';
import { technicianSpecialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const technicianSpecialties = await TechnicianSpecialtyService.getAll();
  return c.json(technicianSpecialties);
});

router.get('/technician/:technicianPhone', async (c) => {
  const technicianPhone = c.req.param('technicianPhone');
  const payload = c.var.user!;
  
  // Verificar permisos de acceso
  if (payload.type === 'technician' && payload.phone !== technicianPhone) {
    return c.json({ error: 'Can only view own specialties' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only view specialties for technicians in your company' }, 403);
    }
  }
  
  const technicianSpecialties = await TechnicianSpecialtyService.getByTechnicianPhone(technicianPhone);
  return c.json(technicianSpecialties);
});

router.get('/specialty/:specialtyId', async (c) => {
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const technicianSpecialties = await TechnicianSpecialtyService.getBySpecialtyId(specialtyId);
  return c.json(technicianSpecialties);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Solo compañías y super_admins pueden gestionar especialidades de técnicos
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage technician specialties' }, 403);
  }
  
  // Si es una compañía, verificar que el técnico pertenece a esa compañía
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(data.technicianPhone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only manage specialties for technicians in your company' }, 403);
    }
  }
  
  const validatedData = technicianSpecialtySchema.parse(data);
  const technicianSpecialty = await TechnicianSpecialtyService.create(validatedData);
  return c.json(technicianSpecialty, 201);
});

router.delete('/:technicianPhone/:specialtyId', async (c) => {
  const technicianPhone = c.req.param('technicianPhone');
  const specialtyId = parseInt(c.req.param('specialtyId'));
  const payload = c.var.user!;
  
  // Solo compañías y super_admins pueden gestionar especialidades de técnicos
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can manage technician specialties' }, 403);
  }
  
  // Si es una compañía, verificar que el técnico pertenece a esa compañía
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Can only manage specialties for technicians in your company' }, 403);
    }
  }
  
  await TechnicianSpecialtyService.delete(technicianPhone, specialtyId);
  return c.json({ message: 'Deleted' });
});

export default router;