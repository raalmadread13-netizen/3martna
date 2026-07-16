import { Router } from 'express';
import { leasesController } from '@presentation/http/controllers/occupancy.controllers';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { idempotency } from '@presentation/http/middleware/idempotency';
import { validate } from '@presentation/http/middleware/validate';
import {
  createLeaseSchema,
  leaseListQuerySchema,
  terminateLeaseSchema,
  updateLeaseSchema,
} from '@presentation/http/validation/occupancy.validation';
import { idParamsSchema } from '@presentation/http/validation/property.validation';

export const leasesRoutes = Router();

leasesRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /leases:
 *   get:
 *     tags: [Leases]
 *     summary: List lease contracts (cursor pagination, search, filter, sort)
 *     parameters:
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string }, description: Matches the contract number }
 *       - { in: query, name: status, schema: { type: string, enum: [Draft, Active, Expired, Terminated, Cancelled] } }
 *       - { in: query, name: apartmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: residentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [startDate, endDate, createdAt, monthlyRent, contractNumber], default: startDate } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: "Cursor page: { data, nextCursor, limit }" }
 *   post:
 *     tags: [Leases]
 *     summary: Create a lease contract (takes effect immediately)
 *     description: >
 *       The lessor is the apartment's owner. Guarded by the business rules:
 *       one active lease per apartment, one active lease per resident, and
 *       no overlapping lease dates for the same apartment.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apartmentId, residentId, startDate, endDate, monthlyRent]
 *             properties:
 *               apartmentId: { type: string, format: uuid }
 *               residentId: { type: string, format: uuid }
 *               contractNumber: { type: string, description: Auto-generated when omitted }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               monthlyRent: { type: number, minimum: 0.01 }
 *               currency: { type: string, example: JOD }
 *               depositAmount: { type: number, minimum: 0 }
 *               paymentFrequency: { type: string, enum: [Monthly, Quarterly, SemiAnnual, Annual], default: Monthly }
 *               lateFeePercent: { type: number, minimum: 0, maximum: 100 }
 *               graceDays: { type: integer, minimum: 0, maximum: 30 }
 *     responses:
 *       201: { description: Lease created (status Active) }
 *       404: { description: Apartment or resident not found }
 *       409: { description: Active lease exists / dates overlap / contract number taken / apartment has no owner }
 */
leasesRoutes.get(
  '/',
  requirePermission('leases.read'),
  validate({ query: leaseListQuerySchema }),
  leasesController.list,
);
leasesRoutes.post(
  '/',
  requirePermission('leases.manage'),
  validate({ body: createLeaseSchema }),
  idempotency,
  leasesController.create,
);

/**
 * @openapi
 * /leases/{id}:
 *   get:
 *     tags: [Leases]
 *     summary: Lease details
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lease }
 *       404: { description: Not found }
 *   put:
 *     tags: [Leases]
 *     summary: Extend the lease (new end date after the current one)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endDate]
 *             properties:
 *               endDate: { type: string, format: date }
 *     responses:
 *       200: { description: Extended lease }
 *       404: { description: Not found }
 *       409: { description: Extension overlaps another lease }
 *       422: { description: Lease not active or end date not after the current one }
 */
leasesRoutes.get(
  '/:id',
  requirePermission('leases.read'),
  validate({ params: idParamsSchema }),
  leasesController.get,
);
leasesRoutes.put(
  '/:id',
  requirePermission('leases.manage'),
  validate({ params: idParamsSchema, body: updateLeaseSchema }),
  leasesController.update,
);

/**
 * @openapi
 * /leases/{id}/terminate:
 *   post:
 *     tags: [Leases]
 *     summary: Terminate an active lease (automatically ends its occupancy)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 500 }
 *     responses:
 *       200: { description: Lease terminated; any active occupancy was closed }
 *       404: { description: Not found }
 *       422: { description: Only active leases can be terminated }
 */
leasesRoutes.post(
  '/:id/terminate',
  requirePermission('leases.manage'),
  validate({ params: idParamsSchema, body: terminateLeaseSchema }),
  idempotency,
  leasesController.terminate,
);
