import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { AppError } from '@shared/errors/AppError';

export interface RequestSchemas {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Joi request validation. Validated (and type-coerced) values replace the
 * originals, unknown body keys are stripped — handlers only ever see
 * clean input.
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
          AppError.badRequest(
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
        Object.assign(req.query as Record<string, unknown>, value);
      } else {
        (req as unknown as Record<string, unknown>)[segment] = value;
      }
    }
    next();
  };

/* Reusable field schemas for later sprints */
export const idSchema = Joi.number().integer().positive();
export const pageQuerySchema = {
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
};
