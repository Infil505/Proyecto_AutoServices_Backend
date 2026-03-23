import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService.js';
import type { AppContext } from '../types.js';

const router = new Hono<AppContext>();

router.get('/', async (c) => {
  const payload = c.var.user!;
  let appointments;
  if (payload.type === 'technician') {
    appointments = await AppointmentService.getAll().then(all => 
      all.filter(a => a.technicianPhone === payload.phone)
    );
  } else if (payload.type === 'company') {
    // Companies can see appointments for their business
    appointments = await AppointmentService.getAll().then(all => 
      all.filter(a => a.companyPhone === payload.phone)
    );
  } else {
    // super_admin sees all
    appointments = await AppointmentService.getAll();
  }
  return c.json(appointments);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  const appointment = await AppointmentService.getById(id);
  if (!appointment) return c.json({ error: 'Not found' }, 404);
  
  // Check access
  if (payload.type === 'technician' && appointment.technicianPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  if (payload.type === 'company' && appointment.companyPhone !== payload.phone) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json(appointment);
});

router.post('/', async (c) => {
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only companies and super_admins can create appointments
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can create appointments' }, 403);
  }
  
  const appointment = await AppointmentService.create(data);
  return c.json(appointment, 201);
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const payload = c.var.user!;
  
  // Only companies and super_admins can update appointments
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can update appointments' }, 403);
  }
  
  const appointment = await AppointmentService.update(id, data);
  return c.json(appointment);
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const payload = c.var.user!;
  
  // Only companies and super_admins can delete appointments
  if (payload.type !== 'company' && payload.type !== 'super_admin') {
    return c.json({ error: 'Only companies and super_admins can delete appointments' }, 403);
  }
  
  await AppointmentService.delete(id);
  return c.json({ message: 'Deleted' });
});

export default router;