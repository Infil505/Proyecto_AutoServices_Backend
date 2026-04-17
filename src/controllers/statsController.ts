import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import { CompanyService } from '../services/companyService.js';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { CustomerService } from '../services/customerService.js';
import { ServiceService } from '../services/serviceService.js';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

/**
 * GET /api/v1/stats
 * Returns lightweight counts — only COUNT(*) queries, no row data.
 * Response shape depends on caller role:
 *   super_admin → { companies, appointments, technicians, customers, services }
 *   company     → { appointments, technicians, services, zones }
 *   technician  → { appointments }
 */
router.get('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type === 'super_admin') {
    const [companies, appointments, technicians, customers, services] = await Promise.all([
      CompanyService.countAll(),
      AppointmentService.countAll(),
      TechnicianService.countAll(),
      CustomerService.countAll(),
      ServiceService.countAll(),
    ]);
    return c.json({ companies, appointments, technicians, customers, services });
  }

  if (payload.type === 'company') {
    const cp = payload.companyPhone ?? payload.phone;
    const [appointments, completedAppointments, technicians, activeTechnicians, services, activeServices, zones] = await Promise.all([
      AppointmentService.countByCompany(cp),
      AppointmentService.countCompletedByCompany(cp),
      TechnicianService.countByCompany(cp),
      TechnicianService.countAvailableByCompany(cp),
      ServiceService.countByCompany(cp),
      ServiceService.countActiveByCompany(cp),
      CoverageZoneService.countByCompany(cp),
    ]);
    return c.json({ appointments, completedAppointments, technicians, activeTechnicians, services, activeServices, zones });
  }

  const appointments = await AppointmentService.countByTechnician(payload.phone);
  return c.json({ appointments });
});

export default router;
