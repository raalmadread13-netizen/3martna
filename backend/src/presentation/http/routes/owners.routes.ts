import { Router } from 'express';
import { ownersController } from '@presentation/http/controllers/owners.controller';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { validate } from '@presentation/http/middleware/validate';
import {
  createOwnerSchema,
  idParamsSchema,
  pageQuerySchema,
  updateOwnerSchema,
} from '@presentation/http/validation/property.validation';

export const ownersRoutes = Router();

ownersRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /owners:
 *   get:
 *     tags: [Owners]
 *     summary: List apartment owners of the tenant (paged)
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200: { description: Paged owner list }
 *       401: { description: Missing or invalid token }
 *       403: { description: Missing owners.read permission or tenant context }
 *   post:
 *     tags: [Owners]
 *     summary: Register an owner (individual or company)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName]
 *             properties:
 *               ownerType: { type: string, enum: [Individual, Company], default: Individual }
 *               fullName: { type: string, minLength: 2, maxLength: 200 }
 *               companyName: { type: string, nullable: true, description: Required for Company owners }
 *               nationalIdOrRegistration: { type: string, nullable: true }
 *               email: { type: string, nullable: true }
 *               phoneNumber: { type: string, nullable: true }
 *               address: { type: string, nullable: true }
 *     responses:
 *       201: { description: Owner created }
 *       400: { description: Validation failure }
 *       422: { description: Company owner without a company name }
 */
ownersRoutes.get(
  '/',
  requirePermission('owners.read'),
  validate({ query: pageQuerySchema }),
  ownersController.list,
);
ownersRoutes.post(
  '/',
  requirePermission('owners.manage'),
  validate({ body: createOwnerSchema }),
  ownersController.create,
);

/**
 * @openapi
 * /owners/{id}:
 *   get:
 *     tags: [Owners]
 *     summary: Owner details
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Owner }
 *       404: { description: Not found (or belongs to another tenant) }
 *   put:
 *     tags: [Owners]
 *     summary: Update owner identity or contact details
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
 *               fullName: { type: string }
 *               companyName: { type: string, nullable: true }
 *               nationalIdOrRegistration: { type: string, nullable: true }
 *               email: { type: string, nullable: true }
 *               phoneNumber: { type: string, nullable: true }
 *               address: { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated owner }
 *       404: { description: Not found }
 */
ownersRoutes.get(
  '/:id',
  requirePermission('owners.read'),
  validate({ params: idParamsSchema }),
  ownersController.get,
);
ownersRoutes.put(
  '/:id',
  requirePermission('owners.manage'),
  validate({ params: idParamsSchema, body: updateOwnerSchema }),
  ownersController.update,
);
