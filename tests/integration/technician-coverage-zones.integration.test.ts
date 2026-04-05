/**
 * Integration tests — Technician Coverage Zones (many-to-many junction table)
 *
 * Skipped automatically when DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test';

setDefaultTimeout(30_000);
import { Hono } from 'hono';

const DB_AVAILABLE = !!process.env.DATABASE_URL;

const CO_PHONE = '+19995550021';
const TECH1_PHONE = '+19995550022';
const TECH2_PHONE = '+19995550023';
let ZONE_ID: number;

const setup = DB_AVAILABLE
  ? await (async () => {
      const { db } = await import('../../src/db/index');
      const { companies, technicians, coverageZones, technicianCoverageZones, users } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { default: tcZoneRoutes } = await import('../../src/routes/technicianCoverageZoneRoutes');
      const { default: coverageZoneRoutes } = await import('../../src/routes/coverageZoneRoutes');
      return { db, companies, technicians, coverageZones, technicianCoverageZones, users, eq, tcZoneRoutes, coverageZoneRoutes };
    })()
  : null;

type AppContext = { Variables: { user: { id: number; type: string; phone: string; companyPhone?: string; iat: number; exp: number } } };

function buildApp(type: 'company' | 'super_admin' | 'technician', phone: string, companyPhone?: string) {
  const { tcZoneRoutes, coverageZoneRoutes } = setup!;
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type, phone, companyPhone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/technician-coverage-zones', tcZoneRoutes);
  app.route('/api/v1/coverage-zones', coverageZoneRoutes);
  return app;
}

describe.skipIf(!DB_AVAILABLE)('Technician Coverage Zones (integration)', () => {
  beforeAll(async () => {
    const { db, companies, technicians, coverageZones, technicianCoverageZones, users, eq } = setup!;

    // Clean up potential leftovers
    await db.delete(technicianCoverageZones).where(eq(technicianCoverageZones.technicianPhone, TECH1_PHONE)).catch(() => {});
    await db.delete(technicianCoverageZones).where(eq(technicianCoverageZones.technicianPhone, TECH2_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH1_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH2_PHONE)).catch(() => {});
    await db.delete(users).where(eq(users.phone, CO_PHONE)).catch(() => {});
    await db.delete(companies).where(eq(companies.phone, CO_PHONE)).catch(() => {});

    await db.insert(companies).values({ phone: CO_PHONE, name: 'Integration Co TCZ' });
    await db.insert(users).values({ type: 'company', phone: CO_PHONE, name: 'Integration Co TCZ', passwordHash: 'x' });
    await db.insert(technicians).values({ phone: TECH1_PHONE, companyPhone: CO_PHONE, name: 'Integration Tech 1' });
    await db.insert(technicians).values({ phone: TECH2_PHONE, companyPhone: CO_PHONE, name: 'Integration Tech 2' });

    // Create a coverage zone via HTTP
    const app = buildApp('company', CO_PHONE);
    const res = await app.request('/api/v1/coverage-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyPhone: CO_PHONE, state: 'Test State', city: 'Test City', zoneName: 'Zone Alpha' }),
    });
    const zone = await res.json() as { id: number };
    ZONE_ID = zone.id;
  });

  afterAll(async () => {
    const { db, companies, technicians, coverageZones, technicianCoverageZones, users, eq } = setup!;
    await db.delete(technicianCoverageZones).where(eq(technicianCoverageZones.technicianPhone, TECH1_PHONE)).catch(() => {});
    await db.delete(technicianCoverageZones).where(eq(technicianCoverageZones.technicianPhone, TECH2_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH1_PHONE)).catch(() => {});
    await db.delete(technicians).where(eq(technicians.phone, TECH2_PHONE)).catch(() => {});
    if (ZONE_ID) await db.delete(coverageZones).where(eq(coverageZones.id, ZONE_ID)).catch(() => {});
    await db.delete(users).where(eq(users.phone, CO_PHONE)).catch(() => {});
    await db.delete(companies).where(eq(companies.phone, CO_PHONE)).catch(() => {});
  });

  it('assigns TECH1 to the coverage zone', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request('/api/v1/technician-coverage-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianPhone: TECH1_PHONE, coverageZoneId: ZONE_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { technicianPhone: string; coverageZoneId: number };
    expect(body.technicianPhone).toBe(TECH1_PHONE);
    expect(body.coverageZoneId).toBe(ZONE_ID);
  });

  it('assigns TECH2 to the same zone (many-to-many)', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request('/api/v1/technician-coverage-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianPhone: TECH2_PHONE, coverageZoneId: ZONE_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { technicianPhone: string };
    expect(body.technicianPhone).toBe(TECH2_PHONE);
  });

  it('GET /technician/:phone returns the zone for TECH1', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/technician-coverage-zones/technician/${TECH1_PHONE}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some(z => z.id === ZONE_ID)).toBe(true);
  });

  it('GET /zone/:id returns both technicians', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/technician-coverage-zones/zone/${ZONE_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { phone: string }[];
    const phones = body.map(t => t.phone);
    expect(phones).toContain(TECH1_PHONE);
    expect(phones).toContain(TECH2_PHONE);
  });

  it('technician sees own zone assignments via GET /', async () => {
    const app = buildApp('technician', TECH1_PHONE, CO_PHONE);
    const res = await app.request('/api/v1/technician-coverage-zones');
    expect(res.status).toBe(200);
    // Returns raw junction records: { technicianPhone, coverageZoneId }[]
    const body = await res.json() as { technicianPhone: string; coverageZoneId: number }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some(r => r.coverageZoneId === ZONE_ID)).toBe(true);
  });

  it('removes TECH1 from zone', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/technician-coverage-zones/${TECH1_PHONE}/${ZONE_ID}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
  });

  it('after removal TECH1 no longer appears in zone technicians list', async () => {
    const app = buildApp('company', CO_PHONE);
    const res = await app.request(`/api/v1/technician-coverage-zones/zone/${ZONE_ID}`);
    const body = await res.json() as { phone: string }[];
    const phones = body.map(t => t.phone);
    expect(phones).not.toContain(TECH1_PHONE);
    expect(phones).toContain(TECH2_PHONE);
  });
});
