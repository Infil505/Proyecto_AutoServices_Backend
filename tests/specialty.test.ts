import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import specialtyRoutes from '../src/routes/specialtyRoutes';
import serviceSpecialtyRoutes from '../src/routes/serviceSpecialtyRoutes';
import technicianSpecialtyRoutes from '../src/routes/technicianSpecialtyRoutes';
import type { AppContext } from '../src/types';

function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/specialties', specialtyRoutes);
  app.route('/api/v1/service-specialties', serviceSpecialtyRoutes);
  app.route('/api/v1/technician-specialties', technicianSpecialtyRoutes);
  return app;
}

// ─── SPECIALTIES ────────────────────────────────────────────────────────────

describe('POST /specialties — RBAC', () => {
  it('company returns 403', async () => {
    const client = testClient(createTestApp('company')) as any;
    const res = await client.api.v1.specialties.$post({ json: { name: 'Electricidad' } });
    expect(res.status).toBe(403);
  });

  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.specialties.$post({ json: { name: 'Electricidad' } });
    expect(res.status).toBe(403);
  });
});

describe('POST /specialties — validation (super_admin)', () => {
  const client = testClient(createTestApp('super_admin')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1.specialties.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('name too short returns 400', async () => {
    const res = await client.api.v1.specialties.$post({ json: { name: 'A' } });
    expect(res.status).toBe(400);
  });
});

describe('PUT /specialties/:id — RBAC', () => {
  it('company returns 403', async () => {
    const client = testClient(createTestApp('company')) as any;
    const res = await client.api.v1.specialties[':id'].$put({ param: { id: '1' }, json: { name: 'X' } });
    expect(res.status).toBe(403);
  });

  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.specialties[':id'].$put({ param: { id: '1' }, json: { name: 'X' } });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /specialties/:id — RBAC', () => {
  it('company returns 403', async () => {
    const client = testClient(createTestApp('company')) as any;
    const res = await client.api.v1.specialties[':id'].$delete({ param: { id: '1' } });
    expect(res.status).toBe(403);
  });

  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1.specialties[':id'].$delete({ param: { id: '1' } });
    expect(res.status).toBe(403);
  });
});

// ─── SERVICE SPECIALTIES ────────────────────────────────────────────────────

describe('POST /service-specialties — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['service-specialties'].$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /service-specialties — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1['service-specialties'].$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing specialtyId returns 400', async () => {
    const res = await client.api.v1['service-specialties'].$post({ json: { serviceId: 1 } });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /service-specialties/:serviceId/:specialtyId — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['service-specialties'][':serviceId'][':specialtyId'].$delete({
      param: { serviceId: '1', specialtyId: '2' },
    });
    expect(res.status).toBe(403);
  });
});

// ─── TECHNICIAN SPECIALTIES ─────────────────────────────────────────────────

describe('POST /technician-specialties — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['technician-specialties'].$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /technician-specialties — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1['technician-specialties'].$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing specialtyId returns 400', async () => {
    const res = await client.api.v1['technician-specialties'].$post({
      json: { technicianPhone: '+1234567890' },
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /technician-specialties/:technicianPhone/:specialtyId — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['technician-specialties'][':technicianPhone'][':specialtyId'].$delete({
      param: { technicianPhone: '+1234567890', specialtyId: '1' },
    });
    expect(res.status).toBe(403);
  });
});
