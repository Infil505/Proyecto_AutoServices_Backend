import { Hono } from 'hono';
import technicianSpecialtyController from '../controllers/technicianSpecialtyController.js';

const router = new Hono();

router.route('/technician-specialties', technicianSpecialtyController);

export default router;