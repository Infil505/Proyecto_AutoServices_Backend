/**
 * Integration tests — Auth flow (register company + login)
 *
 * Skipped automatically when DATABASE_URL is not set.
 */
import { afterAll, describe, expect, it, setDefaultTimeout } from 'bun:test';

setDefaultTimeout(30_000);
import { Hono } from 'hono';

const DB_AVAILABLE = !!process.env.DATABASE_URL;

// Valid E.164 phone number unlikely to exist in real data
const TEST_PHONE = '+19995550099';
const TEST_PASSWORD = 'Integr@tion_456';

const setup = DB_AVAILABLE
  ? await (async () => {
      const { db } = await import('../../src/db/index');
      const { users, companies } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { default: authRoutes } = await import('../../src/routes/authRoutes');
      return { db, users, companies, eq, authRoutes };
    })()
  : null;

function buildApp() {
  const app = new Hono();
  app.route('/api/v1/auth', setup!.authRoutes);
  return app;
}

describe.skipIf(!DB_AVAILABLE)('Auth flow (integration)', () => {
  afterAll(async () => {
    const { db, users, companies, eq } = setup!;
    await db.delete(users).where(eq(users.phone, TEST_PHONE)).catch(() => {});
    await db.delete(companies).where(eq(companies.phone, TEST_PHONE)).catch(() => {});
  });

  it('registers a new company successfully', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/register/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: TEST_PHONE, name: 'Integration Auth Co', password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { company: { phone: string } };
    expect(body.company.phone).toBe(TEST_PHONE);
  });

  it('rejects duplicate phone registration', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/register/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: TEST_PHONE, name: 'Duplicate', password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and returns a valid JWT', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: TEST_PHONE, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: { phone: string; type: string } };
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3);
    expect(body.user.phone).toBe(TEST_PHONE);
    expect(body.user.type).toBe('company');
  });

  it('rejects login with wrong password', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: TEST_PHONE, password: 'wrong_password' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects login for non-existent phone', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+19000000001', password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects registration with invalid phone format', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/auth/register/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'not-a-phone', name: 'Bad', password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(400);
  });
});
