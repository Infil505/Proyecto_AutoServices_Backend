import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { getMetrics } from '../middleware/metrics.js';
import { Errors } from '../utils/errors.js';
import type { AppContext } from '../types.js';
import { cacheGet, cacheSet } from '../utils/cache.js';

const GROWTH_TTL_MS   = 60_000; // 1 minute — monthly chart data changes slowly
const ACTIVITY_TTL_MS = 30_000; // 30 seconds

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
 */
router.get('/growth', async (c) => {
  const cached = cacheGet<object[]>('admin:growth');
  if (cached) return c.json(cached);

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

  const rows = await db.execute<{ month: string; companies: string; appointments: string }>(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE source = 'company')     AS companies,
      COUNT(*) FILTER (WHERE source = 'appointment') AS appointments
    FROM (
      SELECT created_at, 'company'     AS source FROM companies    WHERE created_at >= ${sixMonthsAgo}
      UNION ALL
      SELECT created_at, 'appointment' AS source FROM appointments WHERE created_at >= ${sixMonthsAgo}
    ) combined
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
  `);

  const rowMap = new Map(rows.map(r => [r.month, { companies: Number(r.companies), appointments: Number(r.appointments) }]));

  const data = monthLabels.map(month => ({
    month,
    companies:    rowMap.get(month)?.companies    ?? 0,
    appointments: rowMap.get(month)?.appointments ?? 0,
  }));

  cacheSet('admin:growth', data, GROWTH_TTL_MS);
  return c.json(data);
});

/**
 * GET /api/v1/admin/activity
 * Latest 10 platform events (recent companies + recent appointments), sorted by date.
 */
router.get('/activity', async (c) => {
  const cached = cacheGet<object[]>('admin:activity');
  if (cached) return c.json(cached);

  const rows = await db.execute<{
    type: string; message: string; phone: string; created_at: string;
  }>(sql`
    SELECT type, message, phone, created_at FROM (
      SELECT 'company_joined'     AS type, name     AS message, phone,        created_at::text FROM companies    ORDER BY created_at DESC LIMIT 5
      UNION ALL
      SELECT 'appointment_created' AS type, CONCAT('Appointment #', id) AS message, company_phone AS phone, created_at::text FROM appointments ORDER BY created_at DESC LIMIT 5
    ) combined
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const events = rows.map(r => ({
    type:      r.type as 'company_joined' | 'appointment_created',
    message:   r.message,
    phone:     r.phone,
    createdAt: r.created_at,
  }));

  cacheSet('admin:activity', events, ACTIVITY_TTL_MS);
  return c.json(events);
});

export default router;
