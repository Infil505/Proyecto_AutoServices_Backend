import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import companyRoutes from '../src/routes/companyRoutes';
import type { AppContext } from '../src/types';

function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/companies', companyRoutes);
  return app;
}

// ─── POST / ────────────────────────────────────────────────────────────────

describe('POST /companies — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.companies.$post({ json: {} });
    expect(res.status).toBe(403);
  });

  it('company returns 403', async () => {
    const client = testClient(createTestApp('company')) as any;
    const res = await client.api.v1.companies.$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /companies — validation (super_admin)', () => {
  const client = testClient(createTestApp('super_admin')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1.companies.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing name returns 400', async () => {
    const res = await client.api.v1.companies.$post({ json: { phone: '+1234567890' } });
    expect(res.status).toBe(400);
  });

  it('invalid phone format returns 400', async () => {
    const res = await client.api.v1.companies.$post({ json: { phone: 'abc', name: 'Test' } });
    expect(res.status).toBe(400);
  });

  it('invalid startHour format returns 400', async () => {
    const res = await client.api.v1.companies.$post({ json: { phone: '+1234567890', name: 'Test', startHour: '25:00' } });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /:phone ────────────────────────────────────────────────────────────

describe('PUT /companies/:phone — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.companies[':phone'].$put({ param: { phone: '+1234567890' }, json: {} });
    expect(res.status).toBe(403);
  });

  it('company updating a different phone returns 403', async () => {
    const client = testClient(createTestApp('company', '+1111111111')) as any;
    const res = await client.api.v1.companies[':phone'].$put({ param: { phone: '+9999999999' }, json: { name: 'X' } });
    expect(res.status).toBe(403);
  });
});

describe('PUT /companies/:phone — validation', () => {
  it('invalid email returns 400', async () => {
    const client = testClient(createTestApp('super_admin')) as any;
    const res = await client.api.v1.companies[':phone'].$put({
      param: { phone: '+1234567890' },
      json: { email: 'not-an-email' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:phone ─────────────────────────────────────────────────────────

describe('DELETE /companies/:phone — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.companies[':phone'].$delete({ param: { phone: '+1234567890' } });
    expect(res.status).toBe(403);
  });

  it('company deleting a different phone returns 403', async () => {
    const client = testClient(createTestApp('company', '+1111111111')) as any;
    const res = await client.api.v1.companies[':phone'].$delete({ param: { phone: '+9999999999' } });
    expect(res.status).toBe(403);
  });
});
