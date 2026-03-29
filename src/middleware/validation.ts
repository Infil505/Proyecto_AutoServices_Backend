import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

// Validation middleware factory
export const validateBody = (schema: z.ZodSchema): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      c.set('validatedBody', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }, 400);
      }
      return c.json({ error: 'Invalid JSON' }, 400);
    }
  };
};

export const validateQuery = (schema: z.ZodSchema): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const query = c.req.query();
      const validatedData = schema.parse(query);
      c.set('validatedQuery', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Query validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }, 400);
      }
      return c.json({ error: 'Invalid query parameters' }, 400);
    }
  };
};

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') ||
               c.req.header('X-Real-IP') ||
               'unknown';

    const now = Date.now();
    const windowKey = `${ip}:${Math.floor(now / windowMs)}`;

    const current = requestCounts.get(windowKey) || { count: 0, resetTime: now + windowMs };

    if (now > current.resetTime) {
      current.count = 0;
      current.resetTime = now + windowMs;
    }

    if (current.count >= maxRequests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    current.count++;
    requestCounts.set(windowKey, current);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, value] of requestCounts.entries()) {
        if (now > value.resetTime) {
          requestCounts.delete(key);
        }
      }
    }

    await next();
  };
};