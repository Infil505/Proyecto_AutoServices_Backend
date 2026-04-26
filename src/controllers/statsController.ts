import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { db } from '../db/index.js';
import type { AppContext } from '../types.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';

const router = new Hono<AppContext>();

const STATS_TTL_MS = 60_000; // 60s — appointment events already invalidate this via EventEmitter

/** Invalidate all stats caches (call after any appointment/technician/service mutation). */
export function invalidateStatsCache() {
  cacheDeletePrefix('stats:');
}

AppointmentService.events.on('appointment:created', invalidateStatsCache);
AppointmentService.events.on('appointment:updated', invalidateStatsCache);
AppointmentService.events.on('appointment:deleted', invalidateStatsCache);

/**
 * GET /api/v1/stats
 * Each role executes a single CTE query instead of N parallel COUNT queries,
 * keeping connection usage at 1 regardless of how many metrics are returned.
 *
 *   super_admin → { companies, appointments, technicians, customers, services }
 *   company     → { appointments, completedAppointments, technicians, activeTechnicians, services, activeServices, zones }
 *   technician  → { appointments }
 */
router.get('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type === 'super_admin') {
    const key = 'stats:super_admin';
    const cached = cacheGet<object>(key);
    if (cached) return c.json(cached);

    const [row] = await db.execute<{
      companies: string; appointments: string; technicians: string;
      customers: string; services: string;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM companies)::int    AS companies,
        (SELECT COUNT(*) FROM appointments)::int AS appointments,
        (SELECT COUNT(*) FROM technicians)::int  AS technicians,
        (SELECT COUNT(*) FROM customers)::int    AS customers,
        (SELECT COUNT(*) FROM services)::int     AS services
    `);

    const result = {
      companies:    Number(row.companies),
      appointments: Number(row.appointments),
      technicians:  Number(row.technicians),
      customers:    Number(row.customers),
      services:     Number(row.services),
    };
    cacheSet(key, result, STATS_TTL_MS);
    return c.json(result);
  }

  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const key = `stats:company:${cp}`;
    const cached = cacheGet<object>(key);
    if (cached) return c.json(cached);

    const [row] = await db.execute<{
      appointments: string; completed_appointments: string;
      technicians: string; active_technicians: string;
      services: string; active_services: string;
      zones: string;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM appointments   WHERE company_phone = ${cp})::int                          AS appointments,
        (SELECT COUNT(*) FROM appointments   WHERE company_phone = ${cp} AND status = 'completed')::int AS completed_appointments,
        (SELECT COUNT(*) FROM technicians    WHERE company_phone = ${cp})::int                          AS technicians,
        (SELECT COUNT(*) FROM technicians    WHERE company_phone = ${cp} AND available = true)::int     AS active_technicians,
        (SELECT COUNT(*) FROM services       WHERE company_phone = ${cp})::int                          AS services,
        (SELECT COUNT(*) FROM services       WHERE company_phone = ${cp} AND active = true)::int        AS active_services,
        (SELECT COUNT(*) FROM coverage_zones WHERE company_phone = ${cp})::int                          AS zones
    `);

    const result = {
      appointments:          Number(row.appointments),
      completedAppointments: Number(row.completed_appointments),
      technicians:           Number(row.technicians),
      activeTechnicians:     Number(row.active_technicians),
      services:              Number(row.services),
      activeServices:        Number(row.active_services),
      zones:                 Number(row.zones),
    };
    cacheSet(key, result, STATS_TTL_MS);
    return c.json(result);
  }

  // technician
  const key = `stats:technician:${payload.phone}`;
  const cached = cacheGet<object>(key);
  if (cached) return c.json(cached);

  const [row] = await db.execute<{ appointments: string }>(sql`
    SELECT (SELECT COUNT(*) FROM appointments WHERE technician_phone = ${payload.phone})::int AS appointments
  `);

  const result = { appointments: Number(row.appointments) };
  cacheSet(key, result, STATS_TTL_MS);
  return c.json(result);
});

export default router;
