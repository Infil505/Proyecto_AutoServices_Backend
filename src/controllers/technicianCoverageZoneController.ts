import { Hono } from 'hono';
import { TechnicianCoverageZoneService } from '../services/technicianCoverageZoneService.js';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';
import { technicianCoverageZoneSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

// GET / — list assignments by role
router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const [data, total] = await Promise.all([
      TechnicianCoverageZoneService.getByTechnician(payload.phone, { limit, offset }),
      TechnicianCoverageZoneService.countByTechnician(payload.phone),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const [data, total] = await Promise.all([
      TechnicianCoverageZoneService.getByCompany(cp, { limit, offset }),
      TechnicianCoverageZoneService.countByCompany(cp),
    ]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([
    TechnicianCoverageZoneService.getAll({ limit, offset }),
    TechnicianCoverageZoneService.countAll(),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

// GET /technician/:phone — zones assigned to a technician (full zone data)
router.get('/technician/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician' && phone !== payload.phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.UNAUTHORIZED, 403);
    }
  }

  const [data, total] = await Promise.all([
    TechnicianCoverageZoneService.getZonesByTechnician(phone, { limit, offset }),
    TechnicianCoverageZoneService.countZonesByTechnician(phone),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

// GET /zone/:id — technicians assigned to a zone (full technician data)
router.get('/zone/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    return c.json(Errors.UNAUTHORIZED, 403);
  }
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.UNAUTHORIZED, 403);
    }
  }

  const [data, total] = await Promise.all([
    TechnicianCoverageZoneService.getTechniciansByZone(id, { limit, offset }),
    TechnicianCoverageZoneService.countTechniciansByZone(id),
  ]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

// POST / — assign technician to zone (company or super_admin)
router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json(Errors.ZONE_ASSIGN_ONLY_COMPANY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = technicianCoverageZoneSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const { technicianPhone, coverageZoneId } = result.data;

  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== cp) {
      return c.json(Errors.ZONE_TECHNICIAN_NOT_OWN, 403);
    }
    const zone = await CoverageZoneService.getById(coverageZoneId);
    if (!zone || zone.companyPhone !== cp) {
      return c.json(Errors.ZONE_NOT_OWN_COMPANY, 403);
    }
  }

  const existing = await TechnicianCoverageZoneService.getAssignment(technicianPhone, coverageZoneId);
  if (existing) return c.json(Errors.ZONE_ASSIGNMENT_EXISTS, 409);

  const assignment = await TechnicianCoverageZoneService.create({ technicianPhone, coverageZoneId });
  return c.json(assignment, 201);
});

// DELETE /?technicianPhone=&zoneId= — remove assignment (company or super_admin)
router.delete('/', async (c) => {
  const technicianPhone = c.req.query('technicianPhone');
  const zoneId = parseIntParam(c.req.query('zoneId') ?? '');
  if (!technicianPhone || !zoneId) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json(Errors.ZONE_REMOVE_ONLY_COMPANY, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== (payload.companyPhone ?? payload.phone)) {
      return c.json(Errors.ZONE_TECHNICIAN_NOT_OWN, 403);
    }
  }

  const existing = await TechnicianCoverageZoneService.getAssignment(technicianPhone, zoneId);
  if (!existing) return c.json(Errors.ZONE_ASSIGNMENT_NOT_FOUND, 404);

  await TechnicianCoverageZoneService.delete(technicianPhone, zoneId);
  return c.json({ message: 'Deleted' });
});

export default router;
