import { Router } from 'express';
import Joi from 'joi';
import { dashboardController } from '@presentation/http/controllers/dashboard.controller';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { validate } from '@presentation/http/middleware/validate';

export const dashboardRoutes = Router();

// Read-only reporting surface — one permission gates all of it
dashboardRoutes.use(authenticate, requireTenant, requirePermission('dashboard.read'));

const activityQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(15),
});

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Headline statistics for the tenant's portfolio
 *     description: >
 *       Buildings, apartments (occupied/vacant), owners, residents, active
 *       and expiring (30-day) leases, occupancy rate, and the maintenance
 *       placeholder — computed by the report services from aggregated
 *       queries (fixed number of round trips, no N+1).
 *     responses:
 *       200: { description: Dashboard summary }
 *       401: { description: Missing or invalid token }
 *       403: { description: Missing dashboard.read permission or tenant context }
 */
dashboardRoutes.get('/summary', dashboardController.summary);

/**
 * @openapi
 * /dashboard/buildings:
 *   get:
 *     tags: [Dashboard]
 *     summary: Per-building occupancy summaries
 *     description: One card per building — apartment count, occupied, vacant, occupancy percentage.
 *     responses:
 *       200: { description: Building summary list (ordered by name) }
 */
dashboardRoutes.get('/buildings', dashboardController.buildings);

/**
 * @openapi
 * /dashboard/lease-alerts:
 *   get:
 *     tags: [Dashboard]
 *     summary: Lease alerts
 *     description: Active leases expiring within 30 days (soonest first) and expired leases.
 *     responses:
 *       200: { description: "{ expiringSoon: [], expired: [] }" }
 */
dashboardRoutes.get('/lease-alerts', dashboardController.leaseAlerts);

/**
 * @openapi
 * /dashboard/activity:
 *   get:
 *     tags: [Dashboard]
 *     summary: Recent activity, newest first
 *     description: >
 *       Building created, apartment added, resident registered, lease
 *       created, move-in and move-out events, derived from the domain
 *       tables' own timestamps.
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50, default: 15 } }
 *     responses:
 *       200: { description: Activity list }
 *       400: { description: Invalid limit }
 */
dashboardRoutes.get(
  '/activity',
  validate({ query: activityQuerySchema }),
  dashboardController.activity,
);
