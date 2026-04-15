import { desc, gte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { appointments, companies } from '../db/schema.js';
import { getMetrics } from '../middleware/metrics.js';
import { Errors } from '../utils/errors.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

/** Guard — all routes in this controller are super_admin only. */
router.use('*', async (c, next) => {
  if (c.var.user?.type !== 'super_admin') return c.json(Errors.UNAUTHORIZED, 403);
  await next();
});

/**
 * GET /api/v1/admin/metrics
 * Returns system health data: uptime, memory, response times, DB latency.
 */
router.get('/metrics', async (c) => {
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    return c.json({ error: 'Database unreachable' }, 503);
  }
  const dbLatency = Date.now() - dbStart;

  const m = getMetrics();
  const mem = process.memoryUsage();

  return c.json({
    uptime: Date.now() - m.startTime,
    memory: {
      used: mem.heapUsed,
      total: mem.heapTotal,
      percent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
    responseTime: {
      avg: Math.round(m.responseTime.avg),
      min: m.responseTime.min === Infinity ? 0 : m.responseTime.min,
      max: m.responseTime.max,
    },
    requests: {
      total: m.requests.total,
      errors: m.requests.errors,
    },
    database: {
      status: 'online',
      latencyMs: dbLatency,
    },
  });
});

/**
 * GET /api/v1/admin/growth
 * Monthly company + appointment counts for the past 6 months.
 * Uses Drizzle query builder (not db.execute) for compatibility with Supabase pooler.
 */
router.get('/growth', async (c) => {
  // Build last 6 month labels (YYYY-MM strings)
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [companyRows, apptRows] = await Promise.all([
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${companies.createdAt}), 'YYYY-MM')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(companies)
      .where(gte(companies.createdAt, sixMonthsAgo))
      .groupBy(sql`DATE_TRUNC('month', ${companies.createdAt})`),
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${appointments.createdAt}), 'YYYY-MM')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(appointments)
      .where(gte(appointments.createdAt, sixMonthsAgo))
      .groupBy(sql`DATE_TRUNC('month', ${appointments.createdAt})`),
  ]);

  const companyMap = new Map(companyRows.map(r => [r.month, Number(r.count)]));
  const apptMap    = new Map(apptRows.map(r => [r.month, Number(r.count)]));

  const data = monthLabels.map(month => ({
    month,
    companies:    companyMap.get(month) ?? 0,
    appointments: apptMap.get(month) ?? 0,
  }));

  return c.json(data);
});

/**
 * GET /api/v1/admin/activity
 * Latest 10 platform events (recent companies + recent appointments), sorted by date.
 */
router.get('/activity', async (c) => {
  const [recentCompanies, recentAppointments] = await Promise.all([
    db.select().from(companies).orderBy(desc(companies.createdAt)).limit(5),
    db.select().from(appointments).orderBy(desc(appointments.createdAt)).limit(5),
  ]);

  const events = [
    ...recentCompanies.map(company => ({
      type: 'company_joined' as const,
      message: company.name,
      phone: company.phone,
      createdAt: company.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
    ...recentAppointments.map(apt => ({
      type: 'appointment_created' as const,
      message: `Appointment #${apt.id}`,
      phone: apt.companyPhone,
      createdAt: apt.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return c.json(events);
});

export default router;
