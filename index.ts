import { timingSafeEqual } from "crypto";
import { Hono, type Context, type Next } from "hono";
import logger from "./src/utils/logger.js";
import { cors } from "hono/cors";
import { config } from "./src/config/index.js";
import { rateLimit } from "./src/middleware/validation.js";
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
import docsRoutes from "./src/routes/docs.js";
import type { AppContext } from "./src/types.js";
import { startAppointmentWebsocket } from "./src/ws/appointmentWebsocket.js";
import { EmailService } from "./src/services/emailService.js";

const app = new Hono<AppContext>();

// Start badge websocket feed for appointments (pub/sub)
startAppointmentWebsocket();

// Start email listener — sends PDF to customer when both statuses are completed
EmailService.startEmailListener();

// JWT verification middleware
function jwtMiddleware(secret: string) {
  return async (c: Context<AppContext>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, secret);
    if (!payload) {
      return c.json({ error: "Invalid token" }, 401);
    }
    c.set("user", payload as AppContext["Variables"]["user"]);
    await next();
  };
}

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.http(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// CORS middleware
app.use("*", cors({ origin: config.corsOrigins }));

// Rate limiting
app.use("*", rateLimit(config.rateLimitMax, config.rateLimitWindowMs));

// Public auth routes
app.route("/api/v1/auth", authRoutes);

// JWT middleware for protected routes
const jwtProtect = jwtMiddleware(config.jwtSecret);
app.use("/api/v1/appointments/*", jwtProtect);
app.use("/api/v1/companies/*", jwtProtect);
app.use("/api/v1/customers/*", jwtProtect);
app.use("/api/v1/services/*", jwtProtect);
app.use("/api/v1/service-specialties/*", jwtProtect);
app.use("/api/v1/specialties/*", jwtProtect);
app.use("/api/v1/technicians/*", jwtProtect);
app.use("/api/v1/technician-specialties/*", jwtProtect);
app.use("/api/v1/coverage-zones/*", jwtProtect);
app.use("/api/v1/technician-coverage-zones/*", jwtProtect);
app.use("/api/v1/users/*", jwtProtect);

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

// Health check
app.get("/health", (c) =>
  c.json({ status: "OK", timestamp: new Date().toISOString() }),
);

// Emergency shutdown — independent credentials, rate limited, audited
const shutdownAttempts = new Map<string, { count: number; resetAt: number }>();

app.post("/health/shutdown", async (c) => {
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0].trim() ||
    c.req.header("X-Real-IP") ||
    "unknown";

  // 5 attempts per 15 minutes per IP
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entry = shutdownAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      console.warn(`[SHUTDOWN] Rate limited: ${ip} at ${new Date().toISOString()}`);
      return c.json({ error: "Too many attempts" }, 429);
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
    return c.json({ error: "Invalid credentials" }, 401);
  }

  console.warn(`[SHUTDOWN] Emergency shutdown triggered from ${ip} at ${new Date().toISOString()}`);
  setTimeout(() => process.exit(0), 300);
  return c.json({ message: "Shutting down" }, 200);
});

// API Documentation (Swagger UI + OpenAPI spec)
app.route("/api/v1", docsRoutes);

app.get("/", (c) =>
  c.text("AutoServices Backend API - REST API with JWT Authentication"),
);

// Global error handler
app.onError((err, c) => {
  logger.error(`${c.req.method} ${c.req.path} — ${err.message}\n${err.stack}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log("AutoServices REST API running on http://localhost:3000");
console.log("API Documentation:");
console.log("  POST /api/auth/register - Register new user");
console.log("  POST /api/auth/login - Login");
console.log("  GET /health - Health check");
console.log("  Protected endpoints require: Authorization: Bearer <token>");
