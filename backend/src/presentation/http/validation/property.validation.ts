import Joi from 'joi';

/** GUID route/body identifier (ADR-0003: all ids are GUIDs). */
export const guid = Joi.string().uuid({ version: ['uuidv4', 'uuidv5'] });

export const idParamsSchema = Joi.object({ id: guid.required() });
export const floorParamsSchema = Joi.object({ id: guid.required(), floorId: guid.required() });

export const pageQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const apartmentListQuerySchema = pageQuerySchema.keys({
  buildingId: guid,
});

/* --------------------------- Buildings ------------------------- */

export const createBuildingSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  address: Joi.string().min(5).max(300).required(),
  city: Joi.string().min(2).max(100).required(),
  district: Joi.string().max(100).allow(null, ''),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  totalFloors: Joi.number().integer().min(1).max(200).required(),
  yearBuilt: Joi.number().integer().min(1900).max(2100).allow(null),
  notes: Joi.string().max(500).allow(null, ''),
});

export const updateBuildingSchema = Joi.object({
  name: Joi.string().min(2).max(150),
  address: Joi.string().min(5).max(300),
  city: Joi.string().min(2).max(100),
  district: Joi.string().max(100).allow(null, ''),
  notes: Joi.string().max(500).allow(null, ''),
}).min(1);

/* ----------------------------- Floors -------------------------- */

export const createFloorSchema = Joi.object({
  floorNumber: Joi.number().integer().min(-5).max(200).required(),
  name: Joi.string().max(50).allow(null, ''),
});

export const updateFloorSchema = Joi.object({
  name: Joi.string().max(50).allow(null, '').required(),
});

/* --------------------------- Apartments ------------------------ */

export const APARTMENT_STATUSES = [
  'Available',
  'Leased',
  'OwnerOccupied',
  'UnderMaintenance',
  'Reserved',
] as const;

export const createApartmentSchema = Joi.object({
  buildingId: guid.required(),
  floorId: guid.required(),
  unitNumber: Joi.string().min(1).max(20).required(),
  bedrooms: Joi.number().integer().min(0).max(20),
  bathrooms: Joi.number().integer().min(0).max(20),
  areaSqm: Joi.number().positive().max(100000).allow(null),
  baseRentAmount: Joi.number().min(0).max(1000000000).allow(null),
  currency: Joi.string().length(3).uppercase(),
  description: Joi.string().max(500).allow(null, ''),
});

export const updateApartmentSchema = Joi.object({
  bedrooms: Joi.number().integer().min(0).max(20),
  bathrooms: Joi.number().integer().min(0).max(20),
  areaSqm: Joi.number().positive().max(100000).allow(null),
  baseRentAmount: Joi.number().min(0).max(1000000000).allow(null),
  description: Joi.string().max(500).allow(null, ''),
  status: Joi.string().valid(...APARTMENT_STATUSES),
  ownerId: guid,
}).min(1);

/* ----------------------------- Owners -------------------------- */

export const createOwnerSchema = Joi.object({
  ownerType: Joi.string().valid('Individual', 'Company').default('Individual'),
  fullName: Joi.string().min(2).max(200).required(),
  companyName: Joi.string().min(2).max(200).allow(null, ''),
  nationalIdOrRegistration: Joi.string().max(30).allow(null, ''),
  email: Joi.string().email().max(255).allow(null, ''),
  phoneNumber: Joi.string()
    .pattern(/^\+?[0-9]{9,15}$/)
    .allow(null, '')
    .messages({ 'string.pattern.base': 'phoneNumber must be a valid international number' }),
  address: Joi.string().max(300).allow(null, ''),
});

export const updateOwnerSchema = Joi.object({
  fullName: Joi.string().min(2).max(200),
  companyName: Joi.string().min(2).max(200).allow(null, ''),
  nationalIdOrRegistration: Joi.string().max(30).allow(null, ''),
  email: Joi.string().email().max(255).allow(null, ''),
  phoneNumber: Joi.string()
    .pattern(/^\+?[0-9]{9,15}$/)
    .allow(null, '')
    .messages({ 'string.pattern.base': 'phoneNumber must be a valid international number' }),
  address: Joi.string().max(300).allow(null, ''),
}).min(1);
