import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import technicianRoutes from '../src/routes/technicianRoutes';
import type { AppContext } from '../src/types';

function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, jti: 'test-jti', tokenType: 'access' as const, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/technicians', technicianRoutes);
  return app;
}

// ─── POST / ────────────────────────────────────────────────────────────────

describe('POST /technicians — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.technicians.$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /technicians — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1.technicians.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing name returns 400', async () => {
    const res = await client.api.v1.technicians.$post({
      json: { phone: '+1122334455', password: 'secret123' },
    });
    expect(res.status).toBe(400);
  });

  it('password too short returns 400', async () => {
    const res = await client.api.v1.technicians.$post({
      json: { phone: '+1122334455', name: 'Tech A', password: '123' },
    });
    expect(res.status).toBe(400);
  });

  it('invalid phone format returns 400', async () => {
    const res = await client.api.v1.technicians.$post({
      json: { phone: 'bad', name: 'Tech A', password: 'secret123' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /:phone ────────────────────────────────────────────────────────────

describe('PUT /technicians/:phone — RBAC', () => {
  it('technician updating a different phone returns 403', async () => {
    const client = testClient(createTestApp('technician', '+1111111111')) as any;
    const res = await client.api.v1.technicians[':phone'].$put({
      param: { phone: '+9999999999' },
      json: { name: 'New Name' },
    });
    expect(res.status).toBe(403);
  });
});

describe('PUT /technicians/:phone — validation', () => {
  it('invalid email returns 400 for own phone (technician)', async () => {
    const client = testClient(createTestApp('technician', '+1111111111')) as any;
    const res = await client.api.v1.technicians[':phone'].$put({
      param: { phone: '+1111111111' },
      json: { email: 'not-an-email' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:phone ─────────────────────────────────────────────────────────

describe('DELETE /technicians/:phone — RBAC', () => {
  it('technician deleting a different phone returns 403', async () => {
    const client = testClient(createTestApp('technician', '+1111111111')) as any;
    const res = await client.api.v1.technicians[':phone'].$delete({ param: { phone: '+9999999999' } });
    expect(res.status).toBe(403);
  });
});
