import { Hono } from 'hono';
import { CompanyService } from '../services/companyService.js';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';
import { companySchema, companyAdminSchema } from '../validation/schemas.js';
import { parsePagination, createPaginatedResponse } from '../utils/pagination.js';
import { handleDbError } from '../utils/dbErrors.js';
import { Errors, validationErrorBody } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';
import logger from '../utils/logger.js';

const COMPANIES_LIST_TTL_MS = 30_000;

function invalidateCompaniesCache() {
  cacheDeletePrefix('companies:list:');
}

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);

  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const company = await CompanyService.getById(cp);
    return c.json(createPaginatedResponse(company ? [company] : [], company ? 1 : 0, { page: 1, limit: 1, offset: 0, sortOrder: 'desc' }));
  }

  const { page, limit, offset } = parsePagination(c);
  const cacheKey = `companies:list:${page}:${limit}`;
  const cached = cacheGet<ReturnType<typeof createPaginatedResponse>>(cacheKey);
  if (cached) return c.json(cached);

  const [data, total] = await Promise.all([
    CompanyService.getAll({ limit, offset }),
    CompanyService.countAll(),
  ]);

  const response = createPaginatedResponse(data, total, { page, limit, offset, sortOrder: 'desc' });
  cacheSet(cacheKey, response, COMPANIES_LIST_TTL_MS);
  return c.json(response);
});

router.get('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);

  const company = await CompanyService.getById(phone);
  if (!company) return c.json(Errors.NOT_FOUND, 404);

  if (payload.type === 'company' && (payload.companyPhone ?? payload.phone) !== phone) {
    return c.json(Errors.UNAUTHORIZED, 403);
  }

  return c.json(company);
});

router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') {
    return c.json(Errors.COMPANY_CREATE_ONLY_ADMIN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = companySchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const company = await CompanyService.create(result.data);
  invalidateCompaniesCache();
  return c.json(company, 201);
});

router.put('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'company' && (payload.companyPhone ?? payload.phone) !== phone) {
    return c.json(Errors.COMPANY_UPDATE_OWN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = companySchema.partial().safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const updated = await CompanyService.update(phone, result.data);
  invalidateCompaniesCache();
  return c.json(updated);
});

router.delete('/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician') return c.json(Errors.UNAUTHORIZED, 403);
  if (payload.type === 'company' && (payload.companyPhone ?? payload.phone) !== phone) {
    return c.json(Errors.COMPANY_DELETE_OWN, 403);
  }

  await CompanyService.delete(phone);
  invalidateCompaniesCache();
  return c.json({ message: 'Deleted' });
});

router.post('/:phone/admin', async (c) => {
  const companyPhone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type !== 'super_admin') return c.json(Errors.ONLY_SUPER_ADMIN, 403);

  const company = await CompanyService.getById(companyPhone);
  if (!company) return c.json(Errors.NOT_FOUND, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = companyAdminSchema.safeParse(body);
  if (!result.success) return c.json(validationErrorBody(result.error), 400);

  try {
    const { phone, name, email } = result.data;
    const user = await UserService.create({ type: 'company', phone, name, email, companyPhone, passwordHash: null });
    const setupToken = await UserService.generateSetupToken(user.id);
    if (email) {
      void import('../utils/email.js').then(({ sendInviteEmail }) =>
        sendInviteEmail({ to: email, name, role: 'company', token: setupToken })
      ).catch((err) => logger.warn(`[companyController] Failed to send invite email to ${email}: ${err}`));
    }
    return c.json({ user, setupToken }, 201);
  } catch (err) {
    const mapped = handleDbError(err);
    return c.json({ error: mapped.error }, mapped.status as any);
  }
});

export default router;
