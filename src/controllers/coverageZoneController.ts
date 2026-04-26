import { Hono } from 'hono';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { TechnicianCoverageZoneService } from '../services/technicianCoverageZoneService.js';
import type { AppContext } from '../types.js';
import { coverageZoneSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';
import logger from '../utils/logger.js';

const ZONES_TTL = 30_000;

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  const { page, limit, offset } = parsePagination(c);

  try {
    if (payload.type === 'technician') {
      const cacheKey = `zones:tech:${payload.phone}`;
      const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
      if (cached) return c.json(cached);
      const data = await TechnicianCoverageZoneService.getZonesByTechnician(payload.phone);
      const result = createPaginatedResponse(data, data.length, { page, limit, offset, sortOrder: 'desc' });
      cacheSet(cacheKey, result, ZONES_TTL);
      return c.json(result);
    }
    if (payload.type === 'company') {
      const cp = payload.companyPhone ?? payload.phone;
      const cacheKey = `zones:co:${cp}:${page}:${limit}`;
      const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
      if (cached) return c.json(cached);
      const [data, total] = await Promise.all([CoverageZoneService.getByCompany(cp, { limit, offset }), CoverageZoneService.countByCompany(cp)]);
      const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
      cacheSet(cacheKey, result, ZONES_TTL);
      return c.json(result);
    }
    const cacheKey = `zones:admin:${page}:${limit}`;
    const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
    if (cached) return c.json(cached);
    const [data, total] = await Promise.all([CoverageZoneService.getAll({ limit, offset }), CoverageZoneService.countAll()]);
    const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
    cacheSet(cacheKey, result, ZONES_TTL);
    return c.json(result);
  } catch (err) {
    logger.error(`GET /coverage-zones failed for ${payload.type} ${payload.phone}: ${String(err)}`);
    return c.json({ error: 'Error al obtener zonas de cobertura' }, 500);
  }
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

  const companyPhone = payload.type === 'company'
    ? (payload.companyPhone ?? payload.phone)
    : result.data.companyPhone;
  if (!companyPhone) return c.json({ error: 'companyPhone is required' }, 400);

  const zone = await CoverageZoneService.create({ ...result.data, companyPhone });
  cacheDeletePrefix('zones:');
  return c.json(zone, 201);
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

  const { companyPhone: _stripped, ...updateWithoutCompanyPhone } = result.data;
  const dataToUpdate = payload.type === 'company' ? updateWithoutCompanyPhone : result.data;
  const updated = await CoverageZoneService.update(id, dataToUpdate);
  if (!updated) return c.json(Errors.NOT_FOUND, 404);
  cacheDeletePrefix('zones:');
  return c.json(updated);
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
  cacheDeletePrefix('zones:');
  return c.json({ message: 'Deleted' });
});

export default router;
