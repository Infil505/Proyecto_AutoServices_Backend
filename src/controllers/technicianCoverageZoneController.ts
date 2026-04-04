import { Hono } from 'hono';
import { TechnicianCoverageZoneService } from '../services/technicianCoverageZoneService.js';
import { CoverageZoneService } from '../services/coverageZoneService.js';
import { TechnicianService } from '../services/technicianService.js';
import type { AppContext } from '../types.js';
import { technicianCoverageZoneSchema } from '../validation/schemas.js';

const router = new Hono<AppContext>();

// GET / — lista asignaciones según rol
router.get('/', async (c) => {
  const payload = c.var.user!;
  if (payload.type === 'technician') {
    return c.json(await TechnicianCoverageZoneService.getByTechnician(payload.phone));
  }
  if (payload.type === 'company') {
    const technicians = await TechnicianService.getByCompany(payload.phone);
    const all = await Promise.all(
      technicians.map(t => TechnicianCoverageZoneService.getByTechnician(t.phone))
    );
    return c.json(all.flat());
  }
  return c.json(await TechnicianCoverageZoneService.getAll());
});

// GET /technician/:phone — zonas asignadas a un técnico (con datos completos)
router.get('/technician/:phone', async (c) => {
  const phone = c.req.param('phone');
  const payload = c.var.user!;

  if (payload.type === 'technician' && phone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(phone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
  }

  return c.json(await TechnicianCoverageZoneService.getZonesByTechnician(phone));
});

// GET /zone/:id — técnicos asignados a una zona (con datos completos)
router.get('/zone/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company') {
    const zone = await CoverageZoneService.getById(id);
    if (!zone || zone.companyPhone !== payload.phone) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
  }

  return c.json(await TechnicianCoverageZoneService.getTechniciansByZone(id));
});

// POST / — asignar técnico a zona (company o super_admin)
router.post('/', async (c) => {
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json({ error: 'Solo la compania puede asignar tecnicos a zonas' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const result = technicianCoverageZoneSchema.safeParse(body);
  if (!result.success) {
    return c.json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400);
  }

  const { technicianPhone, coverageZoneId } = result.data;

  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'El tecnico no pertenece a tu compania' }, 403);
    }
    const zone = await CoverageZoneService.getById(coverageZoneId);
    if (!zone || zone.companyPhone !== payload.phone) {
      return c.json({ error: 'La zona no pertenece a tu compania' }, 403);
    }
  }

  const existing = await TechnicianCoverageZoneService.getAssignment(technicianPhone, coverageZoneId);
  if (existing) return c.json({ error: 'El tecnico ya está asignado a esta zona' }, 409);

  const assignment = await TechnicianCoverageZoneService.create({ technicianPhone, coverageZoneId });
  return c.json(assignment, 201);
});

// DELETE /:technicianPhone/:zoneId — remover asignación (company o super_admin)
router.delete('/:technicianPhone/:zoneId', async (c) => {
  const technicianPhone = c.req.param('technicianPhone');
  const zoneId = parseInt(c.req.param('zoneId'));
  const payload = c.var.user!;

  if (payload.type === 'technician') {
    return c.json({ error: 'Solo la compania puede remover asignaciones de zonas' }, 403);
  }
  if (payload.type === 'company') {
    const technician = await TechnicianService.getById(technicianPhone);
    if (!technician || technician.companyPhone !== payload.phone) {
      return c.json({ error: 'El tecnico no pertenece a tu compania' }, 403);
    }
  }

  const existing = await TechnicianCoverageZoneService.getAssignment(technicianPhone, zoneId);
  if (!existing) return c.json({ error: 'Asignacion no encontrada' }, 404);

  await TechnicianCoverageZoneService.delete(technicianPhone, zoneId);
  return c.json({ message: 'Asignacion eliminada' });
});

export default router;
