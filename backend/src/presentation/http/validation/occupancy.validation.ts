import Joi from 'joi';
import { guid } from './property.validation';

const phone = Joi.string()
  .pattern(/^\+?[0-9]{9,15}$/)
  .messages({ 'string.pattern.base': 'phoneNumber must be a valid international number' });

/* ----------------------- cursor list queries ------------------- */

const cursorBase = {
  cursor: Joi.string().max(500),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortDir: Joi.string().valid('asc', 'desc'),
  search: Joi.string().trim().max(100),
};

export const residentListQuerySchema = Joi.object({
  ...cursorBase,
  sortBy: Joi.string().valid('fullName', 'createdAt').default('fullName'),
  sortDir: Joi.string().valid('asc', 'desc').default('asc'),
  status: Joi.string().valid('active', 'inactive'),
  apartmentId: guid,
});

export const leaseListQuerySchema = Joi.object({
  ...cursorBase,
  sortBy: Joi.string()
    .valid('startDate', 'endDate', 'createdAt', 'monthlyRent', 'contractNumber')
    .default('startDate'),
  sortDir: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('Draft', 'Active', 'Expired', 'Terminated', 'Cancelled'),
  apartmentId: guid,
  residentId: guid,
});

export const occupancyListQuerySchema = Joi.object({
  cursor: cursorBase.cursor,
  limit: cursorBase.limit,
  sortBy: Joi.string().valid('moveInDate', 'createdAt').default('moveInDate'),
  sortDir: Joi.string().valid('asc', 'desc').default('desc'),
  apartmentId: guid,
  residentId: guid,
  leaseId: guid,
  active: Joi.boolean(),
});

/* --------------------------- residents ------------------------- */

export const createResidentSchema = Joi.object({
  fullName: Joi.string().min(2).max(200).required(),
  phoneNumber: phone.required(),
  email: Joi.string().email().max(255).allow(null, ''),
  residencyType: Joi.string().valid('OwnerOccupant', 'LeaseTenant', 'FamilyMember'),
  emergencyContactName: Joi.string().max(150).allow(null, ''),
  emergencyContactPhone: phone.allow(null, ''),
});

export const updateResidentSchema = Joi.object({
  fullName: Joi.string().min(2).max(200),
  phoneNumber: phone,
  email: Joi.string().email().max(255).allow(null, ''),
  residencyType: Joi.string().valid('OwnerOccupant', 'LeaseTenant', 'FamilyMember'),
  emergencyContactName: Joi.string().max(150).allow(null, ''),
  emergencyContactPhone: phone.allow(null, ''),
}).min(1);

/* ----------------------------- leases -------------------------- */

/* .raw() keeps the validated value as the original ISO string so
   controllers/DTOs stay string-typed; use-cases parse to Date. */
const isoDate = Joi.date().iso().raw();

export const createLeaseSchema = Joi.object({
  apartmentId: guid.required(),
  residentId: guid.required(),
  contractNumber: Joi.string().min(3).max(30),
  startDate: isoDate.required(),
  endDate: isoDate.greater(Joi.ref('startDate')).required(),
  monthlyRent: Joi.number().positive().max(1000000000).required(),
  currency: Joi.string().length(3).uppercase(),
  depositAmount: Joi.number().min(0).max(1000000000),
  paymentFrequency: Joi.string().valid('Monthly', 'Quarterly', 'SemiAnnual', 'Annual'),
  lateFeePercent: Joi.number().min(0).max(100),
  graceDays: Joi.number().integer().min(0).max(30),
});

export const updateLeaseSchema = Joi.object({
  endDate: isoDate.required(),
});

export const terminateLeaseSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

/* ---------------------------- occupancy ------------------------ */

export const moveInSchema = Joi.object({
  leaseId: guid.required(),
  moveInDate: isoDate,
});

export const moveOutSchema = Joi.object({
  moveOutDate: isoDate,
  reason: Joi.string().trim().max(300).allow(null, ''),
});
