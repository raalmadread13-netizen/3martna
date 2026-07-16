import { Router } from 'express';
import { residentsController } from '@presentation/http/controllers/occupancy.controllers';
import { authenticate, requirePermission, requireTenant } from '@presentation/http/middleware/auth';
import { idempotency } from '@presentation/http/middleware/idempotency';
import { validate } from '@presentation/http/middleware/validate';
import {
  createResidentSchema,
  residentListQuerySchema,
  updateResidentSchema,
} from '@presentation/http/validation/occupancy.validation';
import { idParamsSchema } from '@presentation/http/validation/property.validation';

export const residentsRoutes = Router();

residentsRoutes.use(authenticate, requireTenant);

/**
 * @openapi
 * /residents:
 *   get:
 *     tags: [Residents]
 *     summary: List residents (cursor pagination, search, filter, sort)
 *     parameters:
 *       - { in: query, name: cursor, schema: { type: string }, description: Opaque cursor from the previous page }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string }, description: Matches name, phone or email }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive] } }
 *       - { in: query, name: apartmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [fullName, createdAt], default: fullName } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc], default: asc } }
 *     responses:
 *       200: { description: "Cursor page: { data, nextCursor, limit }" }
 *       401: { description: Missing or invalid token (RFC 7807 body) }
 *       403: { description: Missing residents.read permission or tenant context }
 *   post:
 *     tags: [Residents]
 *     summary: Register a resident (no apartment yet — occupancy comes via Move-In)
 *     parameters:
 *       - { in: header, name: Idempotency-Key, schema: { type: string }, description: Retries replay the stored response }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phoneNumber]
 *             properties:
 *               fullName: { type: string, minLength: 2, maxLength: 200 }
 *               phoneNumber: { type: string, example: "+962790001122" }
 *               email: { type: string, nullable: true }
 *               residencyType: { type: string, enum: [OwnerOccupant, LeaseTenant, FamilyMember], default: LeaseTenant }
 *               emergencyContactName: { type: string, nullable: true }
 *               emergencyContactPhone: { type: string, nullable: true }
 *     responses:
 *       201: { description: Resident registered }
 *       400: { description: Validation failure (RFC 7807) }
 *       409: { description: Idempotency-Key currently being processed }
 *       422: { description: Idempotency-Key reused with a different payload }
 */
residentsRoutes.get(
  '/',
  requirePermission('residents.read'),
  validate({ query: residentListQuerySchema }),
  residentsController.list,
);
residentsRoutes.post(
  '/',
  requirePermission('residents.manage'),
  validate({ body: createResidentSchema }),
  idempotency,
  residentsController.create,
);

/**
 * @openapi
 * /residents/{id}:
 *   get:
 *     tags: [Residents]
 *     summary: Resident details (current occupancy included)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Resident }
 *       404: { description: Not found (or belongs to another tenant) }
 *   put:
 *     tags: [Residents]
 *     summary: Update resident identity/contact details
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
 *               phoneNumber: { type: string }
 *               email: { type: string, nullable: true }
 *               residencyType: { type: string, enum: [OwnerOccupant, LeaseTenant, FamilyMember] }
 *               emergencyContactName: { type: string, nullable: true }
 *               emergencyContactPhone: { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated resident }
 *       404: { description: Not found }
 */
residentsRoutes.get(
  '/:id',
  requirePermission('residents.read'),
  validate({ params: idParamsSchema }),
  residentsController.get,
);
residentsRoutes.put(
  '/:id',
  requirePermission('residents.manage'),
  validate({ params: idParamsSchema, body: updateResidentSchema }),
  residentsController.update,
);
