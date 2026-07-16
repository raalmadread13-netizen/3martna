import { Router } from 'express';
import { occupancyController } from '@presentation/http/controllers/occupancy.controllers';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { idempotency } from '@presentation/http/middleware/idempotency';
import { validate } from '@presentation/http/middleware/validate';
import {
  moveInSchema,
  moveOutSchema,
  occupancyListQuerySchema,
} from '@presentation/http/validation/occupancy.validation';
import { idParamsSchema } from '@presentation/http/validation/property.validation';

export const occupancyRoutes = Router();

occupancyRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /occupancy:
 *   get:
 *     tags: [Occupancy]
 *     summary: Occupancy history (cursor pagination, filter, sort)
 *     description: Every stay ever recorded — move-out closes a record, nothing is deleted.
 *     parameters:
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: apartmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: residentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: leaseId, schema: { type: string, format: uuid } }
 *       - { in: query, name: active, schema: { type: boolean }, description: true = current stays only }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [moveInDate, createdAt], default: moveInDate } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: "Cursor page: { data, nextCursor, limit }" }
 */
occupancyRoutes.get(
  '/',
  requirePermission('occupancy.read'),
  validate({ query: occupancyListQuerySchema }),
  occupancyController.list,
);

/**
 * @openapi
 * /occupancy/move-in:
 *   post:
 *     tags: [Occupancy]
 *     summary: Move a resident into an apartment (requires an ACTIVE lease)
 *     description: >
 *       Opens an occupancy record for the lease's resident and apartment,
 *       stamps the resident's current location and marks the apartment
 *       Leased. Guarded by one-active-stay per apartment and per resident.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leaseId]
 *             properties:
 *               leaseId: { type: string, format: uuid }
 *               moveInDate: { type: string, format: date, description: Defaults to the lease start date }
 *     responses:
 *       201: { description: Occupancy opened }
 *       404: { description: Lease/resident/apartment not found }
 *       409: { description: Lease not active / apartment occupied / resident already moved in }
 *       422: { description: Move-in date outside the lease period }
 */
occupancyRoutes.post(
  '/move-in',
  requirePermission('occupancy.manage'),
  validate({ body: moveInSchema }),
  idempotency,
  occupancyController.moveIn,
);

/**
 * @openapi
 * /occupancy/{id}:
 *   get:
 *     tags: [Occupancy]
 *     summary: One occupancy record
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Occupancy record }
 *       404: { description: Not found }
 */
occupancyRoutes.get(
  '/:id',
  requirePermission('occupancy.read'),
  validate({ params: idParamsSchema }),
  occupancyController.get,
);

/**
 * @openapi
 * /occupancy/{id}/move-out:
 *   post:
 *     tags: [Occupancy]
 *     summary: Move the resident out (closes the stay, history is kept)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               moveOutDate: { type: string, format: date, description: Defaults to today }
 *               reason: { type: string, maxLength: 300, nullable: true }
 *     responses:
 *       200: { description: Occupancy closed — record preserved }
 *       404: { description: Not found }
 *       409: { description: Occupancy already closed }
 *       422: { description: Move-out date precedes move-in date }
 */
occupancyRoutes.post(
  '/:id/move-out',
  requirePermission('occupancy.manage'),
  validate({ params: idParamsSchema, body: moveOutSchema }),
  idempotency,
  occupancyController.moveOut,
);
