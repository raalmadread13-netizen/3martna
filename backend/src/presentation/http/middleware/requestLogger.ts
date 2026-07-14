import { NextFunction, Request, Response } from 'express';
import { logger } from '@infrastructure/logging/logger';

/** Structured request logging (skips the health probe). */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
};
