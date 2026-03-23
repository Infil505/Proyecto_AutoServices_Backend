import { Hono } from 'hono';

// Metrics middleware
export const metricsMiddleware = () => {
  const metrics = {
    requests: {
      total: 0,
      byEndpoint: new Map<string, number>(),
      byMethod: new Map<string, number>(),
      byStatus: new Map<number, number>(),
    },
    responseTime: {
      avg: 0,
      min: Infinity,
      max: 0,
      count: 0,
      sum: 0,
    },
    errors: {
      total: 0,
      byType: new Map<string, number>(),
    },
    uptime: Date.now(),
  };

  return async (c: any, next: any) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    try {
      await next();

      const duration = Date.now() - start;
      const status = c.res.status;

      // Update metrics
      metrics.requests.total++;
      metrics.requests.byEndpoint.set(path, (metrics.requests.byEndpoint.get(path) || 0) + 1);
      metrics.requests.byMethod.set(method, (metrics.requests.byMethod.get(method) || 0) + 1);
      metrics.requests.byStatus.set(status, (metrics.requests.byStatus.get(status) || 0) + 1);

      // Update response time metrics
      metrics.responseTime.count++;
      metrics.responseTime.sum += duration;
      metrics.responseTime.avg = metrics.responseTime.sum / metrics.responseTime.count;
      metrics.responseTime.min = Math.min(metrics.responseTime.min, duration);
      metrics.responseTime.max = Math.max(metrics.responseTime.max, duration);

    } catch (error) {
      metrics.errors.total++;
      const errorType = error.constructor.name;
      metrics.requests.byEndpoint.set(path, (metrics.requests.byEndpoint.get(path) || 0) + 1);
      metrics.requests.byMethod.set(method, (metrics.requests.byMethod.get(method) || 0) + 1);
      metrics.requests.byStatus.set(500, (metrics.requests.byStatus.get(500) || 0) + 1);
      throw error;
    }
  };
};

// Metrics endpoint
export const createMetricsApp = () => {
  const app = new Hono();

  app.get('/metrics', (c) => {
    const metrics = (c as any).metrics || {};

    return c.json({
      uptime: Date.now() - (metrics.uptime || Date.now()),
      requests: {
        total: metrics.requests?.total || 0,
        byMethod: Object.fromEntries(metrics.requests?.byMethod || []),
        byStatus: Object.fromEntries(metrics.requests?.byStatus || []),
        topEndpoints: Object.fromEntries(
          Array.from(metrics.requests?.byEndpoint || [])
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
        ),
      },
      responseTime: metrics.responseTime || {
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
      },
      errors: {
        total: metrics.errors?.total || 0,
        byType: Object.fromEntries(metrics.errors?.byType || []),
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
    });
  });

  return app;
};