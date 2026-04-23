import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { CompanyService } from '../services/companyService.js';
import { UserService } from '../services/userService.js';
import type { AppContext } from '../types.js';
import { adminRegisterSchema, companyRegisterSchema, loginSchema } from '../validation/schemas.js';
import { randomUUID } from 'crypto';
import { verifyJWT, createJWT, parseExpiresIn } from '../utils/jwt.js';
import { blacklistToken, isBlacklisted } from '../utils/tokenBlacklist.js';
import { SessionService } from '../services/sessionService.js';
import { checkLoginAllowed, recordFailedAttempt, resetLoginAttempts } from '../utils/loginLimiter.js';
import { config } from '../config/index.js';
import { handleDbError } from '../utils/dbErrors.js';
import { Errors, validationErrorBody } from '../utils/errors.js';

function setRefreshCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, 'refreshToken', token, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/api/v1/auth',
    maxAge: parseExpiresIn(config.jwtRefreshExpiresIn),
    secure: config.nodeEnv === 'production',
  });
}

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

  const { phone } = result.data;

  const lockCheck = checkLoginAllowed(phone);
  if (!lockCheck.allowed) {
    return c.json(Errors.LOGIN_TOO_MANY_ATTEMPTS, 429);
  }

  const auth = await UserService.authenticate(phone, result.data.password);
  if (!auth) {
    recordFailedAttempt(phone);
    return c.json(Errors.INVALID_CREDENTIALS, 401);
  }

  resetLoginAttempts(phone);
  setRefreshCookie(c, auth.refreshToken);
  return c.json({ user: auth.user, token: auth.token });
});

/**
 * POST /api/auth/refresh
 * Public. Exchanges the httpOnly refreshToken cookie for a new access token.
 */
router.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refreshToken');
  if (!refreshToken) {
    return c.json(Errors.REFRESH_TOKEN_REQUIRED, 400);
  }

  const payload = await verifyJWT(refreshToken, config.jwtSecret);
  if (!payload || payload.tokenType !== 'refresh') {
    return c.json(Errors.INVALID_REFRESH_TOKEN, 401);
  }

  if (payload.jti && await isBlacklisted(payload.jti as string)) {
    return c.json(Errors.INVALID_REFRESH_TOKEN, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + parseExpiresIn(config.jwtExpiresIn);
  const accessJti = randomUUID();

  const token = await createJWT(
    {
      id: payload.id,
      type: payload.type,
      phone: payload.phone,
      ...(payload.companyPhone ? { companyPhone: payload.companyPhone } : {}),
      jti: accessJti,
      tokenType: 'access',
      iat: now,
      exp: accessExp,
    },
    config.jwtSecret
  );

  await SessionService.save(payload.id as number, accessJti, 'access', accessExp);

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
  await blacklistToken(user.jti);

  // Revoke the refresh token from the httpOnly cookie (preferred) or body (fallback).
  const body = await c.req.json().catch(() => null);
  const rawRefreshToken = getCookie(c, 'refreshToken') ?? (
    typeof body?.refreshToken === 'string' ? body.refreshToken : null
  );
  if (rawRefreshToken) {
    const refreshPayload = await verifyJWT(rawRefreshToken, config.jwtSecret);
    if (refreshPayload?.jti && refreshPayload.tokenType === 'refresh') {
      await blacklistToken(refreshPayload.jti as string);
    }
  }
  deleteCookie(c, 'refreshToken', { path: '/api/v1/auth' });

  return c.json({ message: 'Logged out successfully' });
});

export default router;
