import { describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import type { AppContext } from '../src/types';

// ---------------------------------------------------------------------------
// Service mocks — must be declared before importing routes
// ---------------------------------------------------------------------------
const mockAppointments = [
  { id: 1, companyPhone: '+1111111111', technicianPhone: '+2222222222', customerPhone: '+3333333333', status: 'pending' },
  { id: 2, companyPhone: '+9999999999', technicianPhone: '+8888888888', customerPhone: '+7777777777', status: 'confirmed' },
];

mock.module('../src/services/appointmentService', () => ({
  AppointmentService: {
    getAll: mock(() => Promise.resolve(mockAppointments)),
    getByTechnician: mock((phone: string) =>
      Promise.resolve(mockAppointments.filter(a => a.technicianPhone === phone))
    ),
    getByCompany: mock((phone: string) =>
      Promise.resolve(mockAppointments.filter(a => a.companyPhone === phone))
    ),
    getById: mock((id: number) =>
      Promise.resolve(mockAppointments.find(a => a.id === id) ?? null)
    ),
    events: new EventEmitter(),
  },
}));

const mockCompanies = [
  { phone: '+1111111111', name: 'Empresa A' },
  { phone: '+9999999999', name: 'Empresa B' },
];

mock.module('../src/services/companyService', () => ({
  CompanyService: {
    getAll: mock(() => Promise.resolve(mockCompanies)),
    getById: mock((phone: string) =>
      Promise.resolve(mockCompanies.find(c => c.phone === phone) ?? null)
    ),
  },
}));

const mockTechnicians = [
  { phone: '+2222222222', name: 'Tech A', companyPhone: '+1111111111' },
  { phone: '+8888888888', name: 'Tech B', companyPhone: '+9999999999' },
];

mock.module('../src/services/technicianService', () => ({
  TechnicianService: {
    getAll: mock(() => Promise.resolve(mockTechnicians)),
    getByCompany: mock((phone: string) =>
      Promise.resolve(mockTechnicians.filter(t => t.companyPhone === phone))
    ),
    getById: mock((phone: string) =>
      Promise.resolve(mockTechnicians.find(t => t.phone === phone) ?? null)
    ),
  },
}));

// ---------------------------------------------------------------------------
// Import routes after mocks are set up
// ---------------------------------------------------------------------------
const { default: appointmentRoutes } = await import('../src/routes/appointmentRoutes');
const { default: companyRoutes } = await import('../src/routes/companyRoutes');
const { default: technicianRoutes } = await import('../src/routes/technicianRoutes');

function createApp(type: 'technician' | 'company' | 'super_admin', phone: string) {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 1, type, phone, iat: 0, exp: 9_999_999_999 });
    await next();
  });
  app.route('/api/v1/appointments', appointmentRoutes);
  app.route('/api/v1/companies', companyRoutes);
  app.route('/api/v1/technicians', technicianRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns 200 with status OK', async () => {
    const app = new Hono();
    app.get('/health', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }));
    const client = testClient(app) as any;
    const res = await client.health.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(typeof body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /api/appointments
// ---------------------------------------------------------------------------
describe('GET /api/appointments — role filtering', () => {
  it('super_admin receives all appointments', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.appointments.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('company receives only own appointments', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.appointments.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].companyPhone).toBe('+1111111111');
  });

  it('technician receives only own appointments', async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.appointments.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].technicianPhone).toBe('+2222222222');
  });
});

// ---------------------------------------------------------------------------
// GET /api/appointments/:id
// ---------------------------------------------------------------------------
describe('GET /api/appointments/:id — access control', () => {
  it('returns 404 for non-existent id', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('super_admin can access any appointment', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it('company can access own appointment', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '1' } });
    expect(res.status).toBe(200);
  });

  it("company cannot access another company's appointment", async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '2' } });
    expect(res.status).toBe(403);
  });

  it('technician can access own appointment', async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '1' } });
    expect(res.status).toBe(200);
  });

  it("technician cannot access another technician's appointment", async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.appointments[':id'].$get({ param: { id: '2' } });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/companies
// ---------------------------------------------------------------------------
describe('GET /api/companies — role filtering', () => {
  it('super_admin receives all companies', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.companies.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('company receives only own company', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.companies.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].phone).toBe('+1111111111');
  });

  it('technician receives 403', async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.companies.$get();
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/companies/:phone
// ---------------------------------------------------------------------------
describe('GET /api/companies/:phone — access control', () => {
  it('returns 404 for non-existent company', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.companies[':phone'].$get({ param: { phone: '+0000000000' } });
    expect(res.status).toBe(404);
  });

  it('company can access own record', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.companies[':phone'].$get({ param: { phone: '+1111111111' } });
    expect(res.status).toBe(200);
  });

  it("company cannot access another company's record", async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.companies[':phone'].$get({ param: { phone: '+9999999999' } });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/technicians
// ---------------------------------------------------------------------------
describe('GET /api/technicians — role filtering', () => {
  it('super_admin receives all technicians', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.technicians.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('company receives only own technicians', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.technicians.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].companyPhone).toBe('+1111111111');
  });

  it('technician receives only own record', async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.technicians.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].phone).toBe('+2222222222');
  });
});

// ---------------------------------------------------------------------------
// GET /api/technicians/:phone
// ---------------------------------------------------------------------------
describe('GET /api/technicians/:phone — access control', () => {
  it('returns 404 for non-existent technician', async () => {
    const client = testClient(createApp('super_admin', '+0000000000')) as any;
    const res = await client.api.v1.technicians[':phone'].$get({ param: { phone: '+0000000000' } });
    expect(res.status).toBe(404);
  });

  it('technician can access own record', async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.technicians[':phone'].$get({ param: { phone: '+2222222222' } });
    expect(res.status).toBe(200);
  });

  it("technician cannot access another technician's record", async () => {
    const client = testClient(createApp('technician', '+2222222222')) as any;
    const res = await client.api.v1.technicians[':phone'].$get({ param: { phone: '+8888888888' } });
    expect(res.status).toBe(403);
  });

  it('company can access own technician', async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.technicians[':phone'].$get({ param: { phone: '+2222222222' } });
    expect(res.status).toBe(200);
  });

  it("company cannot access another company's technician", async () => {
    const client = testClient(createApp('company', '+1111111111')) as any;
    const res = await client.api.v1.technicians[':phone'].$get({ param: { phone: '+8888888888' } });
    expect(res.status).toBe(403);
  });
});
