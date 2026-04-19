import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { CompanyService } from '../services/companyService.js';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { CustomerService } from '../services/customerService.js';
import { ServiceService } from '../services/serviceService.js';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';
import { cacheGet, cacheSet, cacheDeletePrefix } from '../utils/cache.js';

const router = new Hono<AppContext>();

const STATS_TTL_MS = 15_000; // 15 seconds — balances freshness vs DB load

/** Invalidate all stats caches (call after any appointment/technician/service mutation). */
export function invalidateStatsCache() {
  cacheDeletePrefix('stats:');
}

// Hook into appointment events to auto-invalidate stats
AppointmentService.events.on('appointment:created', invalidateStatsCache);
AppointmentService.events.on('appointment:updated', invalidateStatsCache);
AppointmentService.events.on('appointment:deleted', invalidateStatsCache);

/**
 * GET /api/v1/stats
 * Returns lightweight counts — only COUNT(*) queries, no row data.
 * Response shape depends on caller role:
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

    const [companies, appointments, technicians, customers, services] = await Promise.all([
      CompanyService.countAll(),
      AppointmentService.countAll(),
      TechnicianService.countAll(),
      CustomerService.countAll(),
      ServiceService.countAll(),
    ]);
    const result = { companies, appointments, technicians, customers, services };
    cacheSet(key, result, STATS_TTL_MS);
    return c.json(result);
  }

  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const key = `stats:company:${cp}`;
    const cached = cacheGet<object>(key);
    if (cached) return c.json(cached);

    const [appointments, completedAppointments, technicians, activeTechnicians, services, activeServices, zones] = await Promise.all([
      AppointmentService.countByCompany(cp),
      AppointmentService.countCompletedByCompany(cp),
      TechnicianService.countByCompany(cp),
      TechnicianService.countAvailableByCompany(cp),
      ServiceService.countByCompany(cp),
      ServiceService.countActiveByCompany(cp),
      CoverageZoneService.countByCompany(cp),
    ]);
    const result = { appointments, completedAppointments, technicians, activeTechnicians, services, activeServices, zones };
    cacheSet(key, result, STATS_TTL_MS);
    return c.json(result);
  }

  const key = `stats:technician:${payload.phone}`;
  const cached = cacheGet<object>(key);
  if (cached) return c.json(cached);

  const appointments = await AppointmentService.countByTechnician(payload.phone);
  const result = { appointments };
  cacheSet(key, result, STATS_TTL_MS);
  return c.json(result);
});

export default router;
