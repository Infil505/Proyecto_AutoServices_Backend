import { Hono } from 'hono';
import serviceSpecialtyController from '../controllers/serviceSpecialtyController.js';

const router = new Hono();

router.route('/service-specialties', serviceSpecialtyController);

export default router;