import { NextFunction, Request, Response } from 'express';
import { DomainError } from '@domain/common/DomainError';
import { logger } from '@infrastructure/logging/logger';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

/**
 * Centralized error handler — every error in the app funnels through here.
 *
 * Responses are RFC 7807 Problem Details (application/problem+json):
 * type/title/status/detail/instance, with `code` (stable machine-readable
 * error code) and `errors` (field-level validation issues) as extension
 * members. The legacy `success`/`message`/`details` members are kept as
 * additional extensions so pre-Sprint-5 clients keep working — RFC 7807
 * explicitly allows unknown extension members.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const error =
    err instanceof AppError
      ? err
      : err instanceof DomainError
        ? new AppError(422, err.message, err.code) // business invariant violated
        : AppError.internal(env.isProduction ? 'Internal server error' : err.message);

  if (error.statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  }

  res
    .status(error.statusCode)
    .type('application/problem+json')
    .json({
      type: `https://api.3martna.jo/problems/${error.code.toLowerCase().replace(/_/g, '-')}`,
      title: TITLES[error.statusCode] ?? 'Error',
      status: error.statusCode,
      detail: error.message,
      instance: req.originalUrl,
      code: error.code,
      ...(error.details !== undefined ? { errors: error.details } : {}),
      /* Legacy envelope extensions (backward compatibility) */
      success: false as const,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
};
