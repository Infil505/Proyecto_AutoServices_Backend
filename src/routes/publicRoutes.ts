import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { CompanyService } from '../services/companyService.js';
import { ServiceService } from '../services/serviceService.js';
import { TechnicianService } from '../services/technicianService.js';

const router = new Hono();

/**
 * GET /api/v1/public/stats
 * Platform-wide aggregate counts — no authentication required.
 * Used by the landing page to show real platform growth numbers.
 */
router.get('/stats', async (c) => {
  const [companies, appointments, technicians, services] = await Promise.all([
    CompanyService.countAll(),
    AppointmentService.countAll(),
    TechnicianService.countAll(),
    ServiceService.countAll(),
  ]);
  return c.json({ companies, appointments, technicians, services });
});

export default router;
