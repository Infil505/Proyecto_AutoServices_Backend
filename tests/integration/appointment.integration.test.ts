/**
 * Integration tests — Appointment completion flow
 *
 * Uses HTTP-level testing against the real DB.
 * Run in isolation to avoid unit-test module mocks:
 *   bun test tests/integration/
 *
 * Skipped automatically when DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test';

setDefaultTimeout(30_000);
import { Hono } from 'hono';

const DB_AVAILABLE = !!process.env.DATABASE_URL;

// ── Test identifiers (valid E.164 format, unlikely to exist in real data) ──────
const CO_PHONE = '+19995550011';
const TECH_PHONE = '+19995550012';
const CUST_PHONE = '+19995550013';
const TECH2_PHONE = '+19995550014';
const PASSWORD = 'Integr@tion_123';

// ── Lazy imports so DB client is never touched when DATABASE_URL is absent ─────
const setup = DB_AVAILABLE
  ? await (async () => {
      const { db } = await import('../../src/db/index');
      const { companies, customers, technicians, appointments, users } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { createJWT } = await import('../../src/utils/jwt');
      const { default: appointmentRoutes } = await import('../../src/routes/appointmentRoutes');
      const { default: technicianRoutes } = await import('../../src/routes/technicianRoutes');
      return { db, companies, customers, technicians, appointments, users, eq, createJWT, appointmentRoutes, technicianRoutes };
    })()
  : null;

function buildApp(type: 'company' | 'technician' | 'super_admin', phone: string, companyPhone?: string) {
  const { appointmentRoutes, technicianRoutes } = setup!;
  const app = new Hono<{ Variables: { user: { id: number; type: string; phone: string; companyPhone?: string; iat: number; exp: number } } }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type, phone, companyPhone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/appointments', appointmentRoutes);
  app.route('/api/v1/technicians', technicianRoutes);
  return app;
}

describe.skipIf(!DB_AVAILABLE)('Appointment completion flow (integration)', () => {
  let appointmentId: number;

  beforeAll(async () => {
    const { db, companies, customers, technicians, users, eq } = setup!;

    // Clean up any leftovers from a previous interrupted run
    await db.delete(technicians).where(eq(technicians.phone, TECH_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH2_PHONE)).catch(() => {});
    await db.delete(customers).where(eq(customers.phone, CUST_PHONE)).catch(() => {});
    await db.delete(users).where(eq(users.phone, CO_PHONE)).catch(() => {});
    await db.delete(companies).where(eq(companies.phone, CO_PHONE)).catch(() => {});

    await db.insert(companies).values({ phone: CO_PHONE, name: 'Integration Co APT' });
    await db.insert(users).values({ type: 'company', phone: CO_PHONE, name: 'Integration Co APT', passwordHash: 'x' });
    await db.insert(technicians).values({ phone: TECH_PHONE, companyPhone: CO_PHONE, name: 'Integration Tech 1' });
    await db.insert(customers).values({ phone: CUST_PHONE, name: 'Integration Customer', email: 'test@integration.local' });
  });

  afterAll(async () => {
    const { db, companies, customers, technicians, appointments, users, eq } = setup!;
    if (appointmentId) await db.delete(appointments).where(eq(appointments.id, appointmentId)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH2_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH_PHONE)).catch(() => {});
    await db.delete(customers).where(eq(customers.phone, CUST_PHONE)).catch(() => {});
    await db.delete(users).where(eq(users.phone, CO_PHONE)).catch(() => {});
    await db.delete(companies).where(eq(companies.phone, CO_PHONE)).catch(() => {});
  });

  it('company creates an appointment', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyPhone: CO_PHONE, technicianPhone: TECH_PHONE, customerPhone: CUST_PHONE, status: 'pending' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; status: string };
    appointmentId = body.id;
    expect(body.status).toBe('pending');
    expect(body.id).toBeGreaterThan(0);
  });

  it('setting estatusTecnico=true does NOT complete the appointment', async () => {
    const app = buildApp('technician', TECH_PHONE, CO_PHONE);
    const res = await app.request(`/api/v1/appointments/${appointmentId}/status/tecnico`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatusTecnico: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { estatusTecnico: boolean; status: string };
    expect(body.estatusTecnico).toBe(true);
    expect(body.status).not.toBe('completed');
  });

  it('setting estatusAdministrador=true when tecnico is already true → status=completed', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/appointments/${appointmentId}/status/administrador`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatusAdministrador: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { estatusTecnico: boolean; estatusAdministrador: boolean; status: string };
    expect(body.estatusTecnico).toBe(true);
    expect(body.estatusAdministrador).toBe(true);
    expect(body.status).toBe('completed');
  });

  it('reverse order: admin first then tecnico also auto-completes', async () => {
    const { db, appointments, eq } = setup!;

    const companyApp = buildApp('company', CO_PHONE);
    const techApp = buildApp('technician', TECH_PHONE, CO_PHONE);

    // Create a fresh appointment
    const createRes = await companyApp.request('/api/v1/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyPhone: CO_PHONE, technicianPhone: TECH_PHONE, status: 'pending' }),
    });
    const { id } = await createRes.json() as { id: number };

    // Admin confirms first
    await companyApp.request(`/api/v1/appointments/${id}/status/administrador`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatusAdministrador: true }),
    });

    // Technician confirms second
    const finalRes = await techApp.request(`/api/v1/appointments/${id}/status/tecnico`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatusTecnico: true }),
    });

    await db.delete(appointments).where(eq(appointments.id, id)).catch(() => {});

    const final = await finalRes.json() as { status: string };
    expect(final.status).toBe('completed');
  });

  it('wrong technician cannot update estatusTecnico', async () => {
    const { db, technicians, users, eq } = setup!;

    // Create a 2nd technician to test cross-access
    await db.insert(technicians).values({ phone: TECH2_PHONE, companyPhone: CO_PHONE, name: 'Integration Tech 2' });

    const wrongApp = buildApp('technician', TECH2_PHONE, CO_PHONE);
    const res = await wrongApp.request(`/api/v1/appointments/${appointmentId}/status/tecnico`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatusTecnico: false }),
    });

    expect(res.status).toBe(403);
  });

  it('PDF endpoint returns 200 when both statuses are true', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/appointments/${appointmentId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});
