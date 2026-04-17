import { Hono } from 'hono';
import { CompanyService } from '../services/companyService.js';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';
import { adminRegisterSchema, companyRegisterSchema, loginSchema } from '../validation/schemas.js';
import { verifyJWT, createJWT, parseExpiresIn } from '../utils/jwt.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import { config } from '../config/index.js';
import { handleDbError } from '../utils/dbErrors.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

const router = new Hono<AppContext>();

/**
 * POST /api/auth/register/company
 * Public. Creates a company record and its admin user in a single transaction.
 */
router.post('/register/company', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = companyRegisterSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  try {
    const company = await CompanyService.register(result.data);
    return c.json({ company }, 201);
  } catch (err) {
    const mapped = handleDbError(err);
    return c.json({ error: mapped.error }, mapped.status as any);
  }
});

/**
 * POST /api/auth/register/admin
 * Protected — only super_admin can create another super_admin.
 */
router.post('/register/admin', async (c) => {
  const user = c.var.user;
  if (!user || user.type !== 'super_admin') {
    return c.json(Errors.FORBIDDEN, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = adminRegisterSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const { phone, name, email, password } = result.data;
  try {
    const admin = await UserService.create({ type: 'super_admin', phone, name, email, passwordHash: password });
    return c.json({ user: admin }, 201);
  } catch (err) {
    const mapped = handleDbError(err);
    return c.json({ error: mapped.error }, mapped.status as any);
  }
});

/**
 * POST /api/auth/login
 * Public. Returns a JWT on valid credentials.
 */
router.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(Errors.INVALID_JSON, 400);

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return c.json(validationErrorBody(result.error), 400);
  }

  const auth = await UserService.authenticate(result.data.phone, result.data.password);
  if (!auth) {
    return c.json(Errors.INVALID_CREDENTIALS, 401);
  }

  return c.json({ user: auth.user, token: auth.token, refreshToken: auth.refreshToken });
});

/**
 * POST /api/auth/refresh
 * Public. Exchanges a valid refresh token for a new access token.
 */
router.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.refreshToken || typeof body.refreshToken !== 'string') {
    return c.json(Errors.REFRESH_TOKEN_REQUIRED, 400);
  }

  const payload = await verifyJWT(body.refreshToken, config.jwtSecret);
  if (!payload || payload.tokenType !== 'refresh') {
    return c.json(Errors.INVALID_REFRESH_TOKEN, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await createJWT(
    {
      id: payload.id,
      type: payload.type,
      phone: payload.phone,
      ...(payload.companyPhone ? { companyPhone: payload.companyPhone } : {}),
      tokenType: 'access',
      iat: now,
      exp: now + parseExpiresIn(config.jwtExpiresIn),
    },
    config.jwtSecret
  );

  return c.json({ token });
});

/**
 * POST /api/auth/logout
 * Protected. Revokes the caller's access token (and optionally a refresh token).
 * The JWT middleware rejects revoked tokens even before they expire.
 */
router.post('/logout', async (c) => {
  const user = c.var.user;
  if (!user) return c.json(Errors.MISSING_AUTH_HEADER, 401);

  // Revoke the access token that was used to authenticate this request.
  blacklistToken(user.jti, user.exp);

  // Optionally revoke the refresh token if the client sends it.
  const body = await c.req.json().catch(() => null);
  if (body?.refreshToken && typeof body.refreshToken === 'string') {
    const refreshPayload = await verifyJWT(body.refreshToken, config.jwtSecret);
    if (refreshPayload?.jti && refreshPayload?.exp && refreshPayload.tokenType === 'refresh') {
      blacklistToken(refreshPayload.jti as string, refreshPayload.exp as number);
    }
  }

  return c.json({ message: 'Logged out successfully' });
});

export default router;
