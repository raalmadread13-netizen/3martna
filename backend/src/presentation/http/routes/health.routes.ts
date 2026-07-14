import { Router } from 'express';
import { healthController } from '@presentation/http/controllers/health.controller';

export const healthRoutes = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     security: []
 *     summary: Liveness probe
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 */
healthRoutes.get('/', healthController.check);

/**
 * @openapi
 * /health/details:
 *   get:
 *     tags: [Health]
 *     security: []
 *     summary: Readiness diagnostics (uptime, database, environment)
 *     responses:
 *       200: { description: Diagnostics payload }
 */
healthRoutes.get('/details', healthController.details);
