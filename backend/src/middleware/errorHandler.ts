import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError, fromSqlError } from '../utils/ApiError';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Business errors raised by stored procedures (THROW 50xxx)
  const sqlError = fromSqlError(err);
  const error =
    err instanceof ApiError
      ? err
      : sqlError ?? ApiError.internal(env.isProduction ? 'Internal server error' : err.message);

  if (error.statusCode >= 500) {
    logger.error(err.message, {
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.userId,
    });
  } else {
    logger.debug(`${error.statusCode} ${error.code ?? ''} ${req.method} ${req.originalUrl}`);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code ?? 'ERROR',
    ...(error.details ? { details: error.details } : {}),
  });
};
