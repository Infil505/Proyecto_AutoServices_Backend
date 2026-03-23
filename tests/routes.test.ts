import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';

// Import your routes
import authRoutes from '../src/routes/authRoutes';

describe('Auth Routes', () => {
  const app = new Hono();
  app.route('/api/auth', authRoutes);

  it('should return 400 for invalid registration data', async () => {
    const client = testClient(app);
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
    const client = testClient(app);
    const res = await client.api.auth.register.$post({
      json: {
        type: 'technician'
        // missing phone, name, password
      }
    });

    expect(res.status).toBe(400);
  });
});

describe('Health Check', () => {
  it('should return OK status', async () => {
    const app = new Hono();
    app.get('/health', (c) => c.json({ status: 'OK' }));

    const client = testClient(app);
    const res = await client.health.$get();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
  });
});