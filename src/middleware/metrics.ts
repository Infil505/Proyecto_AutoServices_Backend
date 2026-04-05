import { Hono } from 'hono';

// Singleton — shared between middleware and endpoint
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

export const metricsMiddleware = () => {
  return async (c: any, next: any) => {
    const start = Date.now();
    const method: string = c.req.method;
    const path: string = c.req.path;

    try {
      await next();

      const duration = Date.now() - start;
      const status: number = c.res.status;

      metrics.requests.total++;
      metrics.requests.byEndpoint.set(path, (metrics.requests.byEndpoint.get(path) ?? 0) + 1);
      metrics.requests.byMethod.set(method, (metrics.requests.byMethod.get(method) ?? 0) + 1);
      metrics.requests.byStatus.set(status, (metrics.requests.byStatus.get(status) ?? 0) + 1);

      metrics.responseTime.count++;
      metrics.responseTime.sum += duration;
      metrics.responseTime.avg = metrics.responseTime.sum / metrics.responseTime.count;
      metrics.responseTime.min = Math.min(metrics.responseTime.min, duration);
      metrics.responseTime.max = Math.max(metrics.responseTime.max, duration);
    } catch (error) {
      metrics.errors.total++;
      const errorType = (error as Error).constructor?.name ?? 'UnknownError';
      metrics.errors.byType.set(errorType, (metrics.errors.byType.get(errorType) ?? 0) + 1);
      metrics.requests.byEndpoint.set(path, (metrics.requests.byEndpoint.get(path) ?? 0) + 1);
      metrics.requests.byMethod.set(method, (metrics.requests.byMethod.get(method) ?? 0) + 1);
      metrics.requests.byStatus.set(500, (metrics.requests.byStatus.get(500) ?? 0) + 1);
      throw error;
    }
  };
};

export const createMetricsApp = () => {
  const app = new Hono();

  app.get('/metrics', (c) => {
    return c.json({
      uptime: Date.now() - metrics.uptime,
      requests: {
        total: metrics.requests.total,
        byMethod: Object.fromEntries(metrics.requests.byMethod),
        byStatus: Object.fromEntries(metrics.requests.byStatus),
        topEndpoints: Object.fromEntries(
          (Array.from(metrics.requests.byEndpoint) as [string, number][])
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
        ),
      },
      responseTime: {
        avg: Math.round(metrics.responseTime.avg),
        min: metrics.responseTime.min === Infinity ? 0 : metrics.responseTime.min,
        max: metrics.responseTime.max,
        count: metrics.responseTime.count,
      },
      errors: {
        total: metrics.errors.total,
        byType: Object.fromEntries(metrics.errors.byType),
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
