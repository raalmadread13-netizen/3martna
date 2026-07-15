import { Router } from 'express';
import { apartmentsController } from '@presentation/http/controllers/apartments.controller';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { validate } from '@presentation/http/middleware/validate';
import {
  apartmentListQuerySchema,
  createApartmentSchema,
  idParamsSchema,
  updateApartmentSchema,
} from '@presentation/http/validation/property.validation';

export const apartmentsRoutes = Router();

apartmentsRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /apartments:
 *   get:
 *     tags: [Apartments]
 *     summary: List apartments of the tenant (optionally filtered by building)
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: buildingId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Paged apartment list }
 *       401: { description: Missing or invalid token }
 *       403: { description: Missing apartments.read permission or tenant context }
 *   post:
 *     tags: [Apartments]
 *     summary: Create an apartment on a floor of a building
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [buildingId, floorId, unitNumber]
 *             properties:
 *               buildingId: { type: string, format: uuid }
 *               floorId: { type: string, format: uuid }
 *               unitNumber: { type: string, maxLength: 20 }
 *               bedrooms: { type: integer, minimum: 0, maximum: 20, default: 1 }
 *               bathrooms: { type: integer, minimum: 0, maximum: 20, default: 1 }
 *               areaSqm: { type: number, nullable: true }
 *               baseRentAmount: { type: number, nullable: true }
 *               currency: { type: string, example: JOD }
 *               description: { type: string, nullable: true }
 *     responses:
 *       201: { description: Apartment created (status Available) }
 *       400: { description: Validation failure }
 *       404: { description: Building or floor not found }
 *       409: { description: Unit number already used in this building }
 */
apartmentsRoutes.get(
  '/',
  requirePermission('apartments.read'),
  validate({ query: apartmentListQuerySchema }),
  apartmentsController.list,
);
apartmentsRoutes.post(
  '/',
  requirePermission('apartments.manage'),
  validate({ body: createApartmentSchema }),
  apartmentsController.create,
);

/**
 * @openapi
 * /apartments/{id}:
 *   get:
 *     tags: [Apartments]
 *     summary: Apartment details
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Apartment }
 *       404: { description: Not found (or belongs to another tenant) }
 *   put:
 *     tags: [Apartments]
 *     summary: Update details, assign an owner, or change status
 *     description: Status changes are validated by the domain state machine (invalid transition → 422).
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               bedrooms: { type: integer, minimum: 0, maximum: 20 }
 *               bathrooms: { type: integer, minimum: 0, maximum: 20 }
 *               areaSqm: { type: number, nullable: true }
 *               baseRentAmount: { type: number, nullable: true }
 *               description: { type: string, nullable: true }
 *               status: { type: string, enum: [Available, Leased, OwnerOccupied, UnderMaintenance, Reserved] }
 *               ownerId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated apartment }
 *       404: { description: Apartment (or referenced owner) not found }
 *       422: { description: Invalid status transition }
 *   delete:
 *     tags: [Apartments]
 *     summary: Archive (soft delete) an apartment
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Archived }
 *       404: { description: Not found }
 */
apartmentsRoutes.get(
  '/:id',
  requirePermission('apartments.read'),
  validate({ params: idParamsSchema }),
  apartmentsController.get,
);
apartmentsRoutes.put(
  '/:id',
  requirePermission('apartments.manage'),
  validate({ params: idParamsSchema, body: updateApartmentSchema }),
  apartmentsController.update,
);
apartmentsRoutes.delete(
  '/:id',
  requirePermission('apartments.manage'),
  validate({ params: idParamsSchema }),
  apartmentsController.archive,
);
