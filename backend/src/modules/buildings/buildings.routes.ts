import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { buildingsController } from './buildings.controller';

export const buildingsRoutes = Router();
buildingsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner');

const buildingBody = {
  name: Joi.string().min(2).max(150),
  nameAr: Joi.string().max(150),
  address: Joi.string().max(300),
  city: Joi.string().max(100),
  district: Joi.string().max(100),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  yearBuilt: Joi.number().integer().min(1900).max(2100),
  imageUrl: Joi.string().uri().max(500),
  notes: Joi.string().max(500),
};

/**
 * @openapi
 * /buildings:
 *   get:
 *     tags: [Buildings]
 *     summary: List buildings (owners see their own; admin sees all)
 *     responses:
 *       200: { description: Paginated buildings with occupancy }
 *   post:
 *     tags: [Buildings]
 *     summary: Create a building (auto-creates floors)
 *     responses:
 *       201: { description: Building created }
 */
buildingsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      search: Joi.string().max(150),
      city: Joi.string().max(100),
      ownerUserId: id,
    }),
  }),
  buildingsController.list,
);

buildingsRoutes.post(
  '/',
  managers,
  validate({
    body: Joi.object({
      ...buildingBody,
      name: buildingBody.name.required(),
      address: buildingBody.address.required(),
      city: buildingBody.city.required(),
      totalFloors: Joi.number().integer().min(1).max(100).default(1),
      ownerUserId: id, // admin only — ignored otherwise
    }),
  }),
  buildingsController.create,
);

buildingsRoutes.get('/:id', validate({ params: idParam }), buildingsController.getById);
buildingsRoutes.put(
  '/:id',
  managers,
  validate({ params: idParam, body: Joi.object(buildingBody).min(1) }),
  buildingsController.update,
);
buildingsRoutes.delete('/:id', managers, validate({ params: idParam }), buildingsController.deactivate);

/* Parking */
buildingsRoutes.get('/:id/parking', validate({ params: idParam }), buildingsController.listParking);
buildingsRoutes.post(
  '/:id/parking',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      parkingSpotId: id,
      spotNumber: Joi.string().max(20).required(),
      apartmentId: id.allow(null),
      spotType: Joi.string().valid('Standard', 'Covered', 'Handicap', 'Visitor'),
      monthlyFee: Joi.number().min(0),
    }),
  }),
  buildingsController.upsertParking,
);
buildingsRoutes.delete(
  '/:id/parking/:spotId',
  managers,
  validate({ params: Joi.object({ id: id.required(), spotId: id.required() }) }),
  buildingsController.deleteParking,
);

/* Storage rooms */
buildingsRoutes.get('/:id/storage', validate({ params: idParam }), buildingsController.listStorage);
buildingsRoutes.post(
  '/:id/storage',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      storageRoomId: id,
      roomNumber: Joi.string().max(20).required(),
      apartmentId: id.allow(null),
      areaSqm: Joi.number().min(0),
      monthlyFee: Joi.number().min(0),
    }),
  }),
  buildingsController.upsertStorage,
);
buildingsRoutes.delete(
  '/:id/storage/:roomId',
  managers,
  validate({ params: Joi.object({ id: id.required(), roomId: id.required() }) }),
  buildingsController.deleteStorage,
);
