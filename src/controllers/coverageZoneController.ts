import { Hono } from 'hono';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { TechnicianCoverageZoneService } from '../services/technicianCoverageZoneService.js';
import type { AppContext } from '../types.js';
import { coverageZoneSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  if (payload.type === 'technician') {
    const data = await TechnicianCoverageZoneService.getZonesByTechnician(payload.phone);
    return c.json(createPaginatedResponse(data, data.length, { page, limit, offset, sortOrder: 'desc' }));
  }
  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const [data, total] = await Promise.all([CoverageZoneService.getByCompany(cp, { limit, offset }), CoverageZoneService.countByCompany(cp)]);
    return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
  }
  const [data, total] = await Promise.all([CoverageZoneService.getAll({ limit, offset }), CoverageZoneService.countAll()]);
  return c.json(createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' }));
});

router.get('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;
  const zone = await CoverageZoneService.getById(id);
  if (!zone) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'company' && zone.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'technician') {
    const assigned = await TechnicianCoverageZoneService.getAssignment(payload.phone, id);
    if (!assigned) return c.json(Errors.UNAUTHORIZED, 403);
  }

  return c.json(zone);
});

router.post('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json(Errors.ZONE_CREATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = coverageZoneSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  return c.json(await CoverageZoneService.create(result.data), 201);
});

router.put('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.ZONE_UPDATE_OWN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = coverageZoneSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  return c.json(await CoverageZoneService.update(id, result.data));
});

router.delete('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== (payload.companyPhone ?? payload.phone)) return c.json(Errors.ZONE_DELETE_OWN, 403);
  }

  await CoverageZoneService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;
