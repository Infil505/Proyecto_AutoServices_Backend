import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiSpec } from '../docs/openapi.js';

const router = new Hono();

router.get('/openapi.json', (c) => c.json(openApiSpec));
router.get('/docs', swaggerUI({ url: '/api/v1/openapi.json' }));

export default router;
