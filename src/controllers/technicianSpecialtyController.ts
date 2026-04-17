import { Hono } from 'hono';
import { TechnicianSpecialtyService } from '../services/technicianSpecialtyService.js';
import { TechnicianService } from '../services/technicianService.js';
import { technicianSpecialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c);
  const [data, total] = await Promise.all([
    TechnicianSpecialtyService.getAll({ limit, offset }),
    TechnicianSpecialtyService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/technician/:technicianPhone', async (c) => {
  const technicianPhone = c.req.param('technicianPhone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && payload.phone !== technicianPhone) {
    return c.json(Errors.TECHNICIAN_SPECIALTY_OWN_VIEW, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.TECHNICIAN_SPECIALTY_VIEW_OWN_COMPANY, 403);
    }
  }

  const technicianSpecialties = await TechnicianSpecialtyService.getByTechnicianPhone(technicianPhone);
  return c.json(technicianSpecialties);
});

router.get('/specialty/:specialtyId', async (c) => {
  const specialtyId = parseIntParam(c.req.param('specialtyId'));
  if (!specialtyId) return c.json(Errors.NOT_FOUND, 404);
  const technicianSpecialties = await TechnicianSpecialtyService.getBySpecialtyId(specialtyId);
  return c.json(technicianSpecialties);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.TECHNICIAN_SPECIALTY_MANAGE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = technicianSpecialtySchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(result.data.technicianPhone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.TECHNICIAN_SPECIALTY_OWN_COMPANY, 403);
    }
  }

  const technicianSpecialty = await TechnicianSpecialtyService.create(result.data);
  return c.json(technicianSpecialty, 201);
});

router.delete('/:technicianPhone/:specialtyId', async (c) => {
  const technicianPhone = c.req.param('technicianPhone');
  const specialtyId = parseIntParam(c.req.param('specialtyId'));
  if (!specialtyId) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.TECHNICIAN_SPECIALTY_MANAGE_ONLY, 403);
  }

  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.TECHNICIAN_SPECIALTY_OWN_COMPANY, 403);
    }
  }

  await TechnicianSpecialtyService.delete(technicianPhone, specialtyId);
  return c.json({ message: 'Deleted' });
});

export default router;
