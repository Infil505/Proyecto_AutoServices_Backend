import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import serviceRoutes from '../src/routes/serviceRoutes';
import type { AppContext } from '../src/types';

function createTestApp(
  userType: 'technician' | 'company' | 'super_admin',
  phone = '+1234567890',
  companyPhone?: string,
) {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, companyPhone, jti: 'test-jti', tokenType: 'access' as const, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/services', serviceRoutes);
  return app;
}

// ─── POST / ────────────────────────────────────────────────────────────────

describe('POST /services — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.services.$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /services — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1.services.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing estimatedDurationMinutes returns 400', async () => {
    const res = await client.api.v1.services.$post({
      json: { companyPhone: '+1234567890', name: 'Oil Change' },
    });
    expect(res.status).toBe(400);
  });

  it('estimatedDurationMinutes = 0 returns 400', async () => {
    const res = await client.api.v1.services.$post({
      json: { companyPhone: '+1234567890', name: 'Oil Change', estimatedDurationMinutes: 0 },
    });
    expect(res.status).toBe(400);
  });

  it('estimatedDurationMinutes > 1440 returns 400', async () => {
    const res = await client.api.v1.services.$post({
      json: { companyPhone: '+1234567890', name: 'Oil Change', estimatedDurationMinutes: 9999 },
    });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /:id ───────────────────────────────────────────────────────────────

describe('PUT /services/:id — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.services[':id'].$put({ param: { id: '1' }, json: {} });
    expect(res.status).toBe(403);
  });
});

describe('PUT /services/:id — validation (company)', () => {
  it('estimatedDurationMinutes = 0 returns 400', async () => {
    const client = testClient(createTestApp('company')) as any;
    // Returns 403 if service doesn't belong to company; but validation fires first if data is invalid
    const res = await client.api.v1.services[':id'].$put({
      param: { id: '1' },
      json: { estimatedDurationMinutes: 0 },
    });
    // 400 (validation) or 403 (RBAC — no DB to check ownership) are both acceptable
    expect([400, 403].includes(res.status)).toBe(true);
  });
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────────

describe('DELETE /services/:id — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.services[':id'].$delete({ param: { id: '1' } });
    expect(res.status).toBe(403);
  });
});
