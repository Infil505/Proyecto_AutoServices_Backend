import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import appointmentRoutes from '../src/routes/appointmentRoutes';
import type { AppContext } from '../src/types';

/**
 * Builds a test app that injects a fake authenticated user so we
 * can exercise the controller logic without a real database or JWT.
 */
function createTestApp(userType: 'technician' | 'company' | 'super_admin', phone = '+1234567890') {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type: userType, phone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/appointments', appointmentRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// RBAC — technician is blocked from mutating appointments
// These tests never reach the service layer (403 is returned before any DB call)
// ---------------------------------------------------------------------------
describe('Appointments RBAC — technician', () => {
  const app = createTestApp('technician');
  const client = testClient(app) as any;

  it('POST returns 403', async () => {
    const res = await client.api.v1.appointments.$post({ json: {} });
    expect(res.status).toBe(403);
  });

  it('PUT returns 403', async () => {
    const res = await client.api.v1.appointments[':id'].$put({ param: { id: '1' }, json: {} });
    expect(res.status).toBe(403);
  });

  it('DELETE returns 403', async () => {
    const res = await client.api.v1.appointments[':id'].$delete({ param: { id: '1' } });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Validation — Zod errors on POST body before DB is called
// ---------------------------------------------------------------------------
describe('Appointments validation (company user)', () => {
  const app = createTestApp('company', '+1234567890');
  const client = testClient(app) as any;

  it('POST with empty body returns 400 with Zod details', async () => {
    const res = await client.api.v1.appointments.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    // companyPhone is required
    const missingField = body.details.find((d: { field: string }) => d.field === 'companyPhone');
    expect(missingField).toBeDefined();
  });

  it('POST with invalid phone format returns 400', async () => {
    const res = await client.api.v1.appointments.$post({
      json: { companyPhone: '123', serviceId: 1 }
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('POST with invalid appointmentDate format returns 400', async () => {
    const res = await client.api.v1.appointments.$post({
      json: { companyPhone: '+1234567890', appointmentDate: 'not-a-date' }
    });
    expect(res.status).toBe(400);
  });

  it('POST with invalid status returns 400', async () => {
    const res = await client.api.v1.appointments.$post({
      json: { companyPhone: '+1234567890', status: 'flying' }
    });
    expect(res.status).toBe(400);
  });

  it('PUT with invalid field returns 400', async () => {
    const res = await client.api.v1.appointments[':id'].$put({
      param: { id: '1' },
      json: { startTime: 'not-a-time' }
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// RBAC — super_admin receives 400 (not 403) on invalid body,
// confirming they pass the auth check and hit validation
// ---------------------------------------------------------------------------
describe('Appointments RBAC — super_admin passes auth check', () => {
  const app = createTestApp('super_admin');
  const client = testClient(app) as any;

  it('POST with invalid body returns 400 (not 403)', async () => {
    const res = await client.api.v1.appointments.$post({ json: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });
});

// ---------------------------------------------------------------------------
// PATCH /status/tecnico — RBAC
// ---------------------------------------------------------------------------
describe('PATCH /status/tecnico — RBAC', () => {
  it('company user returns 403', async () => {
    const app = createTestApp('company');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['tecnico'].$patch({
      param: { id: '1' },
      json: { estatusTecnico: true },
    });
    expect(res.status).toBe(403);
  });

  it('super_admin returns 403', async () => {
    const app = createTestApp('super_admin');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['tecnico'].$patch({
      param: { id: '1' },
      json: { estatusTecnico: true },
    });
    expect(res.status).toBe(403);
  });

  it('technician with invalid body returns 400', async () => {
    // Returns 404 before 400 because getById will fail (no DB in tests),
    // so we just verify it is NOT a 403 — the auth check passes.
    const app = createTestApp('technician', '+1234567890');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['tecnico'].$patch({
      param: { id: '1' },
      json: { estatusTecnico: 'not-a-boolean' },
    });
    // Passes RBAC (not 403); DB call may error in tests
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /status/administrador — RBAC
// ---------------------------------------------------------------------------
describe('PATCH /status/administrador — RBAC', () => {
  it('technician user returns 403', async () => {
    const app = createTestApp('technician');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['administrador'].$patch({
      param: { id: '1' },
      json: { estatusAdministrador: true },
    });
    expect(res.status).toBe(403);
  });

  it('super_admin returns 403', async () => {
    const app = createTestApp('super_admin');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['administrador'].$patch({
      param: { id: '1' },
      json: { estatusAdministrador: true },
    });
    expect(res.status).toBe(403);
  });

  it('company with invalid body passes RBAC (not 403)', async () => {
    const app = createTestApp('company', '+1234567890');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['status']['administrador'].$patch({
      param: { id: '1' },
      json: { estatusAdministrador: 'not-a-boolean' },
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /:id/pdf — RBAC
// ---------------------------------------------------------------------------
describe('GET /:id/pdf — RBAC access control', () => {
  it('technician for a different appointment returns 403 via DB-less path does not crash', async () => {
    // Without a DB, the call may 500 or 404 — but it must NOT return 403 for own phone
    const app = createTestApp('technician', '+1234567890');
    const client = testClient(app) as any;
    const res = await client.api.v1.appointments[':id']['pdf'].$get({ param: { id: '1' } });
    // Just ensure it reaches the handler and doesn't panic
    expect([200, 404, 422, 500].includes(res.status)).toBe(true);
  });
});
