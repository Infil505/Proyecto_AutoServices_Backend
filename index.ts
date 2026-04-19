import { timingSafeEqual } from "crypto";
import { Hono, type Context, type Next } from "hono";
import logger from "./src/utils/logger.js";
import { cors } from "hono/cors";
import { config } from "./src/config/index.js";
import { rateLimit, checkRateLimit } from "./src/middleware/validation.js";
import { metricsMiddleware, createMetricsApp } from "./src/middleware/metrics.js";
import { verifyJWT } from "./src/utils/jwt.js";
import appointmentRoutes from "./src/routes/appointmentRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import companyRoutes from "./src/routes/companyRoutes.js";
import coverageZoneRoutes from "./src/routes/coverageZoneRoutes.js";
import customerRoutes from "./src/routes/customerRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import serviceSpecialtyRoutes from "./src/routes/serviceSpecialtyRoutes.js";
import specialtyRoutes from "./src/routes/specialtyRoutes.js";
import technicianRoutes from "./src/routes/technicianRoutes.js";
import technicianSpecialtyRoutes from "./src/routes/technicianSpecialtyRoutes.js";
import technicianCoverageZoneRoutes from "./src/routes/technicianCoverageZoneRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import statsRoutes from "./src/routes/statsRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import docsRoutes from "./src/routes/docs.js";
import type { AppContext } from "./src/types.js";
import { Errors } from "./src/utils/errors.js";
import { isBlacklisted } from "./src/utils/tokenBlacklist.js";
import { startAppointmentWebsocket } from "./src/ws/appointmentWebsocket.js";
import { EmailService } from "./src/services/emailService.js";
import { PushService } from "./src/services/pushService.js";
import { AppointmentService } from "./src/services/appointmentService.js";
import pushRoutes from "./src/routes/pushRoutes.js";
import { db } from "./src/db/index.js";
import { sql } from "drizzle-orm";

// ── DB health check + connection pool warm-up ────────────────────────────────
// Pre-establish 5 connections so the first real requests don't pay the TCP
// handshake cost (~500ms each on Supabase cloud).
try {
  await Promise.all(Array.from({ length: 5 }, () => db.execute(sql`SELECT 1`)));
  logger.info("Database connection established");
} catch (err) {
  logger.error(`Failed to connect to database: ${(err as Error).message}`);
  process.exit(1);
}

const app = new Hono<AppContext>();

// Start badge websocket feed for appointments (pub/sub)
const wss = startAppointmentWebsocket();

// Start email listener — sends PDF to customer when both statuses are completed
EmailService.startEmailListener();

// Initialize Web Push notifications (requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in .env)
PushService.init();
PushService.attachToEvents(AppointmentService.events);

// Per-user rate limit: 300 req / 15 min per authenticated phone (production).
// Development is relaxed because stress tests share 3 tokens across all VUs —
// in production each real user has their own token and their own bucket.
const USER_RATE_LIMIT_MAX = config.nodeEnv === 'production' ? 300 : 100_000;
const USER_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// JWT verification middleware
function jwtMiddleware(secret: string) {
  return async (c: Context<AppContext>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(Errors.MISSING_AUTH_HEADER, 401);
    }
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, secret);
    if (!payload || payload.tokenType === 'refresh') {
      return c.json(Errors.INVALID_TOKEN, 401);
    }
    if (payload.jti && await isBlacklisted(payload.jti as string)) {
      return c.json(Errors.TOKEN_REVOKED, 401);
    }
    if (!(await checkRateLimit(`user:${payload.phone}`, USER_RATE_LIMIT_WINDOW_MS, USER_RATE_LIMIT_MAX))) {
      return c.json(Errors.TOO_MANY_REQUESTS, 429);
    }
    c.set("user", payload as AppContext["Variables"]["user"]);
    await next();
  };
}

// Overload protection — reject immediately when too many requests are in-flight.
// Prevents the JS event loop from drowning in queued DB promises when the pool
// is exhausted, which would otherwise starve even cache-hit responses.
// At pool=20 and Supabase latency ~300ms, sustainable throughput is ~67 req/s.
// A queue depth of 30 adds at most one extra 300ms batch — anything more causes
// cascading timeouts. /health is exempt so monitoring always passes.
let _inFlight = 0;
const MAX_IN_FLIGHT = config.nodeEnv === 'production' ? 50 : 200;
app.use("*", async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/metrics') return await next();
  if (_inFlight >= MAX_IN_FLIGHT) {
    return c.json({ error: 'Service temporarily overloaded, please retry' }, 503);
  }
  _inFlight++;
  try {
    await next();
  } finally {
    _inFlight--;
  }
});

// Request logging + metrics
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const safePath = c.req.path.replace(/[\r\n\t]/g, '');
  logger.http(`${c.req.method} ${safePath} ${c.res.status} ${ms}ms`);
});
app.use("*", metricsMiddleware());

// CORS middleware
app.use("*", cors({ origin: config.corsOrigins }));

// Rate limiting — /health excluded (monitoring/health-checks must always pass)
app.use("*", async (c, next) => {
  if (c.req.path === '/health') return await next();
  return rateLimit(config.rateLimitMax, config.rateLimitWindowMs)(c, next);
});

// Stricter rate limit for auth endpoints (20 req / 15 min per IP) to mitigate brute force
// In production: 20 login attempts / 15 min (brute-force protection).
// In development: relaxed so stress tests and repeated manual logins don't block.
const authRateLimit = rateLimit(
  config.nodeEnv === 'production' ? 20 : 500,
  config.rateLimitWindowMs,
);
app.use("/api/v1/auth", authRateLimit);
app.use("/api/v1/auth/*", authRateLimit);

// Public routes — no JWT required
app.route("/api/v1/public", publicRoutes);

// Public auth routes (register, login, refresh) — no JWT
app.route("/api/v1/auth", authRoutes);

// JWT middleware for protected routes.
// Each prefix is registered twice: once for the collection endpoint (no trailing
// segment) and once for sub-resource paths, because Hono's `/*` wildcard does
// not match the base path without a trailing slash.
const jwtProtect = jwtMiddleware(config.jwtSecret);
const protectedPrefixes = [
  "/api/v1/auth/logout",
  "/api/v1/auth/register/admin",
  "/api/v1/appointments",
  "/api/v1/companies",
  "/api/v1/customers",
  "/api/v1/services",
  "/api/v1/service-specialties",
  "/api/v1/specialties",
  "/api/v1/technicians",
  "/api/v1/technician-specialties",
  "/api/v1/coverage-zones",
  "/api/v1/technician-coverage-zones",
  "/api/v1/users",
  "/api/v1/stats",
  "/api/v1/admin",
  "/api/v1/push-subscriptions",
] as const;

for (const prefix of protectedPrefixes) {
  app.use(prefix, jwtProtect);
  app.use(`${prefix}/*`, jwtProtect);
}

// Protected routes
app.route("/api/v1/appointments", appointmentRoutes);
app.route("/api/v1/companies", companyRoutes);
app.route("/api/v1/customers", customerRoutes);
app.route("/api/v1/services", serviceRoutes);
app.route("/api/v1/service-specialties", serviceSpecialtyRoutes);
app.route("/api/v1/specialties", specialtyRoutes);
app.route("/api/v1/technicians", technicianRoutes);
app.route("/api/v1/technician-specialties", technicianSpecialtyRoutes);
app.route("/api/v1/coverage-zones", coverageZoneRoutes);
app.route("/api/v1/technician-coverage-zones", technicianCoverageZoneRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/stats", statsRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/push-subscriptions", pushRoutes);

// Health check
app.get("/health", (c) =>
  c.json({ status: "OK", timestamp: new Date().toISOString() }),
);

// Emergency shutdown — independent credentials, rate limited, audited
const shutdownAttempts = new Map<string, { count: number; resetAt: number }>();

app.post("/health/shutdown", async (c) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("X-Real-IP") ||
    "unknown";

  // 5 attempts per 15 minutes per IP
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entry = shutdownAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      console.warn(`[SHUTDOWN] Rate limited: ${ip} at ${new Date().toISOString()}`);
      return c.json(Errors.TOO_MANY_ATTEMPTS, 429);
    }
    entry.count++;
  } else {
    shutdownAttempts.set(ip, { count: 1, resetAt: now + window });
  }

  const body = await c.req.json().catch(() => null);
  const userMatch = body?.user === config.shutdownUser;
  let passMatch = false;
  if (body?.password) {
    try {
      const a = Buffer.from(String(body.password));
      const b = Buffer.from(config.shutdownPassword);
      passMatch = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      passMatch = false;
    }
  }

  if (!userMatch || !passMatch) {
    console.warn(`[SHUTDOWN] Failed attempt from ${ip} at ${new Date().toISOString()}`);
    return c.json(Errors.INVALID_CREDENTIALS, 401);
  }

  console.warn(`[SHUTDOWN] Emergency shutdown triggered from ${ip} at ${new Date().toISOString()}`);
  setTimeout(() => process.exit(0), 300);
  return c.json({ message: "Shutting down" }, 200);
});

// Metrics endpoint (internal — no JWT required)
app.route("/", createMetricsApp());

// API Documentation (Swagger UI + OpenAPI spec)
app.route("/api/v1", docsRoutes);

app.get("/", (c) =>
  c.text("AutoServices Backend API - REST API with JWT Authentication"),
);

// Global error handler
app.onError((err, c) => {
  logger.error(`${c.req.method} ${c.req.path} — ${err.message}\n${err.stack}`);
  return c.json(Errors.INTERNAL_ERROR, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json(Errors.NOT_FOUND, 404);
});

const server = Bun.serve({
  port: config.port,
  idleTimeout: 30,
  fetch: (req, bunServer) => {
    let clientIp = 'unknown';
    try {
      clientIp = bunServer.requestIP(req)?.address ?? 'unknown';
    } catch { /* socket may already be closed on high-load aborted requests */ }
    return app.fetch(req, { clientIp });
  },
});

logger.info(`AutoServices REST API running on http://localhost:${config.port}`);
logger.info(`API docs available at http://localhost:${config.port}/api/v1/docs`);

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  wss.close(() => logger.info("WebSocket server closed"));
  server.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
