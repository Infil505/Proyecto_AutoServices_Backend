import { Hono } from 'hono';
import { SpecialtyService } from '../services/specialtyService.js';
import { specialtySchema } from '../validation/schemas.js';
import type { AppContext } from '../types.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { parseIntParam } from '../utils/params.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';

const SPECIALTIES_TTL = 30_000;

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c);
  const cacheKey = `specialties:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);

  const [data, total] = await Promise.all([
    SpecialtyService.getAll({ limit, offset }),
    SpecialtyService.countAll(),
  ]);
  const result = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, result, SPECIALTIES_TTL);
  return c.json(result);
});

router.get('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const specialty = await SpecialtyService.getById(id);
  if (!specialty) return c.json(Errors.NOT_FOUND, 404);
  return c.json(specialty);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json(Errors.SPECIALTY_CREATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = specialtySchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const specialty = await SpecialtyService.create(result.data);
  cacheDeletePrefix('specialties:');
  return c.json(specialty, 201);
});

router.put('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json(Errors.SPECIALTY_UPDATE_ONLY, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);
  const result = specialtySchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const specialty = await SpecialtyService.update(id, result.data);
  if (!specialty) return c.json(Errors.NOT_FOUND, 404);
  cacheDeletePrefix('specialties:');
  return c.json(specialty);
});

router.delete('/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'));
  if (!id) return c.json(Errors.NOT_FOUND, 404);
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json(Errors.SPECIALTY_DELETE_ONLY, 403);
  }

  const existing = await SpecialtyService.getById(id);
  if (!existing) return c.json(Errors.NOT_FOUND, 404);

  await SpecialtyService.delete(id);
  cacheDeletePrefix('specialties:');
  return c.json({ message: 'Deleted' });
});

export default router;
