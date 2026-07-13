import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/ApiError';

export interface RequestSchemas {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Validate (and sanitise) request segments against Joi schemas.
 * Unknown body keys are rejected; validated values replace the originals
 * so handlers only ever see clean input.
 */
export const validate =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    for (const segment of ['params', 'query', 'body'] as const) {
      const schema = schemas[segment];
      if (!schema) continue;
      const { error, value } = schema.validate(req[segment], {
        abortEarly: false,
        stripUnknown: segment === 'body',
        convert: true,
      });
      if (error) {
        next(
          ApiError.badRequest(
            error.details.map((detail) => detail.message).join('; '),
            'VALIDATION_ERROR',
            error.details.map((detail) => ({
              field: detail.path.join('.'),
              message: detail.message,
            })),
          ),
        );
        return;
      }
      if (segment === 'query') {
        // Express 5 exposes query as a getter — mutate keys in place.
        Object.assign(req.query as Record<string, unknown>, value);
      } else {
        (req as unknown as Record<string, unknown>)[segment] = value;
      }
    }
    next();
  };

/* Shared field schemas */
export const id = Joi.number().integer().positive();
export const pageQuery = {
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
};
export const phone = Joi.string()
  .pattern(/^\+?[0-9]{9,15}$/)
  .messages({ 'string.pattern.base': 'phone must be a valid international number' });
export const password = Joi.string().min(8).max(128);
