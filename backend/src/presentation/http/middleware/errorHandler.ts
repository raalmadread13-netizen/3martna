import { NextFunction, Request, Response } from 'express';
import { DomainError } from '@domain/common/DomainError';
import { logger } from '@infrastructure/logging/logger';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { ApiErrorResponse } from '@shared/types';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

/** Centralized error handler — every error in the app funnels through here. */
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

  const body: ApiErrorResponse = {
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
  res.status(error.statusCode).json(body);
};
