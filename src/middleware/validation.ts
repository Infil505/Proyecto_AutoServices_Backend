import type { MiddlewareHandler } from 'hono';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';

// ── Rate limiting ────────────────────────────────────────────────────────────

// Redis client — lazy, only if REDIS_URL is configured
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!config.redisUrl) return null;
  if (!_redis) {
    _redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    _redis.on('error', () => {
      // Silently fall back to in-memory on connection error
      _redis = null;
    });
  }
  return _redis;
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetTime: number }>();

async function isAllowed(ip: string, windowMs: number, maxRequests: number): Promise<boolean> {
  const redis = getRedis();

  if (redis) {
    try {
      const key = `rl:${ip}:${Math.floor(Date.now() / windowMs)}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      return count <= maxRequests;
    } catch {
      // Fall through to in-memory on Redis error
    }
  }

  // In-memory sliding window
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / windowMs)}`;
  const entry = memoryStore.get(key) ?? { count: 0, resetTime: now + windowMs };
  if (now > entry.resetTime) { entry.count = 0; entry.resetTime = now + windowMs; }
  entry.count++;
  memoryStore.set(key, entry);

  // Periodic cleanup (1% chance)
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore) if (now > v.resetTime) memoryStore.delete(k);
  }

  return entry.count <= maxRequests;
}

/**
 * Check if a given key (IP or user phone) is within its rate limit.
 * Exported so the JWT middleware can do per-user limiting after auth.
 */
export async function checkRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
  return isAllowed(key, windowMs, maxRequests);
}

export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000): MiddlewareHandler => {
  return async (c, next) => {
    // Only trust proxy headers when TRUST_PROXY=true (i.e. behind Cloudflare/Nginx)
    // Without a proxy that strips/sets these headers, clients can spoof their IP
    const ip = config.trustProxy
      ? (c.req.header('CF-Connecting-IP') ||
         c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
         c.req.header('X-Real-IP') ||
         c.env.clientIp ||   // direct TCP IP from Bun (fallback when no proxy headers)
         'unknown')
      : (c.env.clientIp || 'unknown');

    // OPTIONS (CORS preflight) requests are browser-generated and harmless — skip counting
    if (c.req.method === 'OPTIONS') return await next();

    if (!(await isAllowed(ip, windowMs, maxRequests))) {
      return c.json(Errors.TOO_MANY_REQUESTS, 429);
    }

    await next();
  };
};
