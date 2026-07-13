import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { apartmentsController } from './apartments.controller';

export const apartmentsRoutes = Router();
apartmentsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner');

/**
 * @openapi
 * /apartments:
 *   get:
 *     tags: [Apartments]
 *     summary: List apartments with filters (building, status, rent range, search)
 *     responses:
 *       200: { description: Paginated apartments with building, owner & tenant info }
 *   post:
 *     tags: [Apartments]
 *     summary: Create an apartment
 *     responses:
 *       201: { description: Apartment created }
 */
apartmentsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      status: Joi.string().valid('Available', 'Rented', 'OwnerOccupied', 'UnderMaintenance', 'Reserved'),
      search: Joi.string().max(100),
      ownerUserId: id,
      minRent: Joi.number().min(0),
      maxRent: Joi.number().min(0),
    }),
  }),
  apartmentsController.list,
);

apartmentsRoutes.post(
  '/',
  managers,
  validate({
    body: Joi.object({
      buildingId: id.required(),
      floorId: id.required(),
      apartmentNumber: Joi.string().max(20).required(),
      bedrooms: Joi.number().integer().min(0).max(20),
      bathrooms: Joi.number().integer().min(0).max(20),
      areaSqm: Joi.number().min(1),
      rentAmount: Joi.number().min(0),
      ownerUserId: id.allow(null),
      description: Joi.string().max(500),
    }),
  }),
  apartmentsController.create,
);

apartmentsRoutes.get('/:id', validate({ params: idParam }), apartmentsController.getById);

apartmentsRoutes.put(
  '/:id',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      bedrooms: Joi.number().integer().min(0).max(20),
      bathrooms: Joi.number().integer().min(0).max(20),
      areaSqm: Joi.number().min(1),
      rentAmount: Joi.number().min(0),
      status: Joi.string().valid('Available', 'Rented', 'OwnerOccupied', 'UnderMaintenance', 'Reserved'),
      ownerUserId: id.allow(null),
      description: Joi.string().max(500),
    }).min(1),
  }),
  apartmentsController.update,
);

apartmentsRoutes.delete('/:id', managers, validate({ params: idParam }), apartmentsController.remove);

apartmentsRoutes.put(
  '/:id/meters',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      meterType: Joi.string().valid('Electricity', 'Water', 'Gas').required(),
      meterNumber: Joi.string().max(50).required(),
      lastReading: Joi.number().min(0),
      lastReadingDate: Joi.date().iso(),
    }),
  }),
  apartmentsController.upsertMeter,
);
