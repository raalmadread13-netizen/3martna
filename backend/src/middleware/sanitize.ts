import { NextFunction, Request, Response } from 'express';

/**
 * Defence-in-depth XSS sanitisation: strip <script> blocks and inline
 * event handlers from every string field in the body. Output encoding on
 * the clients is the primary defence; this keeps stored data clean.
 */
const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
      .replace(/javascript:/gi, '');
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      clean[key] = sanitizeValue(entry);
    }
    return clean;
  }
  return value;
};

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
};
