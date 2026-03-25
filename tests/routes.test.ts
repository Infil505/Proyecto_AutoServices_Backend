import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';

// Import your routes
import authRoutes from '../src/routes/authRoutes';

describe('Auth Routes', () => {
  const app = new Hono();
  app.route('/api/auth', authRoutes);

  it('should return 400 for invalid registration data', async () => {
    const client = testClient(app) as any;
    const res = await client.api.auth.register.$post({
      json: {
        type: 'invalid_type',
        phone: '123',
        name: '',
        password: '123'
      }
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const client = testClient(app) as any;
    const res = await client.api.auth.register.$post({
      json: {
        type: 'technician'
        // missing phone, name, password
      }
    });

    expect(res.status).toBe(400);
  });
});

describe('Appointment Service Events', () => {
  it('should emit events for appointment operations', async () => {
    type AppointmentEvents =
      | { event: 'created'; appointment: { id: number; status: string } }
      | { event: 'updated'; appointment: { id: number; status: string } }
      | { event: 'deleted'; payload: { id: number } };

    const events: AppointmentEvents[] = [];
    const onCreated = (appointment: { id: number; status: string }) =>
      events.push({ event: 'created', appointment });
    const onUpdated = (appointment: { id: number; status: string }) =>
      events.push({ event: 'updated', appointment });
    const onDeleted = (payload: { id: number }) =>
      events.push({ event: 'deleted', payload });

    const { AppointmentService } = await import('../src/services/appointmentService');

    AppointmentService.events.on('appointment:created', onCreated);
    AppointmentService.events.on('appointment:updated', onUpdated);
    AppointmentService.events.on('appointment:deleted', onDeleted);

    AppointmentService.events.emit('appointment:created', { id: 1, status: 'scheduled' });
    AppointmentService.events.emit('appointment:updated', { id: 1, status: 'done' });
    AppointmentService.events.emit('appointment:deleted', { id: 1 });

    expect(events).toEqual([
      { event: 'created', appointment: { id: 1, status: 'scheduled' } },
      { event: 'updated', appointment: { id: 1, status: 'done' } },
      { event: 'deleted', payload: { id: 1 } },
    ]);
  });
});

describe('Health Check', () => {
  it('should return OK status', async () => {
    const app = new Hono();
    app.get('/health', (c) => c.json({ status: 'OK' }));

    const client = testClient(app) as any;
    const res = await client.health.$get();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
  });
});