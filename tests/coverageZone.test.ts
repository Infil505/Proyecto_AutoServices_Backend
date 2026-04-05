import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import coverageZoneRoutes from '../src/routes/coverageZoneRoutes';
import technicianCoverageZoneRoutes from '../src/routes/technicianCoverageZoneRoutes';
import type { AppContext } from '../src/types';

function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/coverage-zones', coverageZoneRoutes);
  app.route('/api/v1/technician-coverage-zones', technicianCoverageZoneRoutes);
  return app;
}

// ─── COVERAGE ZONES ─────────────────────────────────────────────────────────

describe('POST /coverage-zones — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['coverage-zones'].$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /coverage-zones — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1['coverage-zones'].$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing city returns 400', async () => {
    const res = await client.api.v1['coverage-zones'].$post({
      json: { companyPhone: '+1234567890', state: 'CDMX' },
    });
    expect(res.status).toBe(400);
  });

  it('missing state returns 400', async () => {
    const res = await client.api.v1['coverage-zones'].$post({
      json: { companyPhone: '+1234567890', city: 'Benito Juarez' },
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /coverage-zones/:id — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['coverage-zones'][':id'].$put({ param: { id: '1' }, json: {} });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /coverage-zones/:id — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['coverage-zones'][':id'].$delete({ param: { id: '1' } });
    expect(res.status).toBe(403);
  });
});

// ─── TECHNICIAN COVERAGE ZONES ──────────────────────────────────────────────

describe('POST /technician-coverage-zones — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['technician-coverage-zones'].$post({ json: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /technician-coverage-zones — validation (company)', () => {
  const client = testClient(createTestApp('company')) as any;

  it('empty body returns 400', async () => {
    const res = await client.api.v1['technician-coverage-zones'].$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('missing coverageZoneId returns 400', async () => {
    const res = await client.api.v1['technician-coverage-zones'].$post({
      json: { technicianPhone: '+1234567890' },
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /technician-coverage-zones/:technicianPhone/:zoneId — RBAC', () => {
  it('technician returns 403', async () => {
    const client = testClient(createTestApp('technician')) as any;
    const res = await client.api.v1['technician-coverage-zones'][':technicianPhone'][':zoneId'].$delete({
      param: { technicianPhone: '+1234567890', zoneId: '1' },
    });
    expect(res.status).toBe(403);
  });
});
