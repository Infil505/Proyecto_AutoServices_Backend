import { Hono } from 'hono';
import specialtyController from '../controllers/specialtyController.js';

const router = new Hono();

router.route('/specialties', specialtyController);

export default router;