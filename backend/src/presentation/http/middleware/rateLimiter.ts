import rateLimit from 'express-rate-limit';
import { env } from '@shared/config/env';

/** Global API rate limiter (per IP). Disabled under tests. */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
});

/**
 * Strict limiter for credential endpoints (login, register, forgot/reset).
 * Successful requests don't count, so legitimate users aren't punished.
 */
export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  limit: env.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
    code: 'RATE_LIMITED',
  },
});
