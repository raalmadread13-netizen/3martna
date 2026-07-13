import { NextFunction, Request, Response } from 'express';
import { execProc } from '../config/db';
import { logger } from '../config/logger';

const SENSITIVE_KEYS = new Set(['password', 'newpassword', 'currentpassword', 'refreshtoken', 'idtoken', 'token']);

const redact = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    clean[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return JSON.stringify(clean).slice(0, 4000);
};

/**
 * Persist an audit record for every mutating request, after the response
 * is sent (fire-and-forget — auditing must never block or fail a request).
 */
export const auditTrail = (req: Request, res: Response, next: NextFunction): void => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  res.on('finish', () => {
    if (res.statusCode >= 400) return; // only successful mutations
    execProc('sp_Audit_Insert', {
      UserId: req.user?.userId ?? null,
      Action: `${req.method} ${req.route?.path ?? req.path}`.slice(0, 50),
      EntityType: req.baseUrl.split('/').pop()?.slice(0, 50) ?? null,
      EntityId: (req.params.id ?? null) as string | null,
      NewValues: redact(req.body),
      IpAddress: req.ip?.slice(0, 45) ?? null,
      UserAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    }).catch((error: Error) => logger.warn('Audit insert failed', { error: error.message }));
  });
  next();
};
