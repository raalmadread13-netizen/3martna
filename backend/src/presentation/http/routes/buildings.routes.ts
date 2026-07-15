import { Router } from 'express';
import { buildingsController } from '@presentation/http/controllers/buildings.controller';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { validate } from '@presentation/http/middleware/validate';
import {
  createBuildingSchema,
  createFloorSchema,
  floorParamsSchema,
  idParamsSchema,
  pageQuerySchema,
  updateBuildingSchema,
  updateFloorSchema,
} from '@presentation/http/validation/property.validation';

export const buildingsRoutes = Router();

// Every building operation is authenticated, tenant-scoped and permission-gated
buildingsRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /buildings:
 *   get:
 *     tags: [Buildings]
 *     summary: List buildings of the caller's tenant (paged)
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200: { description: Paged building list }
 *       401: { description: Missing or invalid token }
 *       403: { description: Missing buildings.read permission or tenant context }
 *   post:
 *     tags: [Buildings]
 *     summary: Create a building
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, city, totalFloors]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 150 }
 *               address: { type: string, minLength: 5, maxLength: 300 }
 *               city: { type: string, minLength: 2, maxLength: 100 }
 *               district: { type: string, nullable: true }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               totalFloors: { type: integer, minimum: 1, maximum: 200 }
 *               yearBuilt: { type: integer, nullable: true }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201: { description: Building created (includes empty floors array) }
 *       400: { description: Validation failure }
 *       409: { description: Building name already used in this tenant }
 */
buildingsRoutes.get(
  '/',
  requirePermission('buildings.read'),
  validate({ query: pageQuerySchema }),
  buildingsController.list,
);
buildingsRoutes.post(
  '/',
  requirePermission('buildings.manage'),
  validate({ body: createBuildingSchema }),
  buildingsController.create,
);

/**
 * @openapi
 * /buildings/{id}:
 *   get:
 *     tags: [Buildings]
 *     summary: Building details including its floors
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Building with floors }
 *       404: { description: Not found (or belongs to another tenant) }
 *   put:
 *     tags: [Buildings]
 *     summary: Update building details
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
 *               name: { type: string }
 *               address: { type: string }
 *               city: { type: string }
 *               district: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated building }
 *       404: { description: Not found }
 *       409: { description: New name already used in this tenant }
 *   delete:
 *     tags: [Buildings]
 *     summary: Archive (soft delete) a building
 *     description: Fails with 409 while the building still contains apartments.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Archived }
 *       404: { description: Not found }
 *       409: { description: Building still contains apartments }
 */
buildingsRoutes.get(
  '/:id',
  requirePermission('buildings.read'),
  validate({ params: idParamsSchema }),
  buildingsController.get,
);
buildingsRoutes.put(
  '/:id',
  requirePermission('buildings.manage'),
  validate({ params: idParamsSchema, body: updateBuildingSchema }),
  buildingsController.update,
);
buildingsRoutes.delete(
  '/:id',
  requirePermission('buildings.manage'),
  validate({ params: idParamsSchema }),
  buildingsController.archive,
);

/**
 * @openapi
 * /buildings/{id}/floors:
 *   get:
 *     tags: [Buildings]
 *     summary: List the building's floors (ordered by floor number)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Floor list }
 *       404: { description: Building not found }
 *   post:
 *     tags: [Buildings]
 *     summary: Add a floor to the building
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [floorNumber]
 *             properties:
 *               floorNumber: { type: integer, minimum: -5, maximum: 200 }
 *               name: { type: string, nullable: true }
 *     responses:
 *       201: { description: Floor added }
 *       404: { description: Building not found }
 *       409: { description: Floor number already exists in this building }
 */
buildingsRoutes.get(
  '/:id/floors',
  requirePermission('buildings.read'),
  validate({ params: idParamsSchema }),
  buildingsController.listFloors,
);
buildingsRoutes.post(
  '/:id/floors',
  requirePermission('buildings.manage'),
  validate({ params: idParamsSchema, body: createFloorSchema }),
  buildingsController.addFloor,
);

/**
 * @openapi
 * /buildings/{id}/floors/{floorId}:
 *   put:
 *     tags: [Buildings]
 *     summary: Rename a floor
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: floorId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, nullable: true, maxLength: 50 }
 *     responses:
 *       200: { description: Updated floor }
 *       404: { description: Building or floor not found }
 */
buildingsRoutes.put(
  '/:id/floors/:floorId',
  requirePermission('buildings.manage'),
  validate({ params: floorParamsSchema, body: updateFloorSchema }),
  buildingsController.updateFloor,
);
