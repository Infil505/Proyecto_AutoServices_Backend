import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import customerRoutes from '../src/routes/customerRoutes';
import type { AppContext } from '../src/types';

function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, jti: 'test-jti', tokenType: 'access' as const, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/customers', customerRoutes);
  return app;
}

// ─── GET / ─────────────────────────────────────────────────────────────────

describe('GET /customers — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.customers.$get();
    expect(res.status).toBe(403);
  });
});

// ─── POST / ────────────────────────────────────────────────────────────────

describe('POST /customers — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.customers.$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /customers — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1.customers.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('invalid phone format returns 400', async () => {
    const res = await client.api.v1.customers.$post({ json: { phone: '123' } });
    expect(res.status).toBe(400);
  });

  it('invalid email returns 400', async () => {
    const res = await client.api.v1.customers.$post({ json: { phone: '+1234567890', email: 'bad' } });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /:phone ────────────────────────────────────────────────────────────

describe('PUT /customers/:phone — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.customers[':phone'].$put({ param: { phone: '+1234567890' }, json: {} });
    expect(res.status).toBe(403);
  });
});

describe('PUT /customers/:phone — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('invalid email returns 400', async () => {
    const res = await client.api.v1.customers[':phone'].$put({
      param: { phone: '+1234567890' },
      json: { email: 'not-an-email' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:phone ─────────────────────────────────────────────────────────

describe('DELETE /customers/:phone — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.customers[':phone'].$delete({ param: { phone: '+1234567890' } });
    expect(res.status).toBe(403);
  });
});
