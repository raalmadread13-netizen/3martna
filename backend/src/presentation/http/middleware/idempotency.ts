import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getContainer } from '@presentation/http/container';
import { AppError } from '@shared/errors/AppError';

/**
 * Idempotency-Key support for POST endpoints (Sprint 5).
 *
 * The header is optional; when present, retries of the same request replay
 * the stored response instead of executing again — duplicate submissions can
 * never create duplicate data. Reusing a key with a different payload is
 * rejected (422), and concurrent execution of the same key conflicts (409).
 * Only 2xx responses are stored; failures release the key so clients can
 * retry. Runs after authenticate/validate, so the scope includes the caller
 * and the body is already normalized.
 */
export const idempotency = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.header('Idempotency-Key')?.trim();
  if (!key) {
    next();
    return;
  }
  if (key.length > 200) {
    next(AppError.badRequest('Idempotency-Key is too long (max 200)', 'IDEMPOTENCY_KEY_INVALID'));
    return;
  }

  const path = req.originalUrl.split('?')[0];
  const scope = `${req.user?.userId ?? 'anonymous'}:${req.method}:${path}`;
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body ?? {}))
    .digest('hex');
  const store = getContainer().idempotencyStore;

  store
    .begin(scope, key, requestHash)
    .then((result) => {
      if (result.kind === 'replay') {
        res
          .status(result.responseStatus ?? 200)
          .set('Idempotency-Replayed', 'true')
          .type('application/json')
          .send(result.responseBody ?? '{}');
        return;
      }
      if (result.kind === 'mismatch') {
        next(
          new AppError(
            422,
            'Idempotency-Key was already used with a different request payload',
            'IDEMPOTENCY_KEY_REUSED',
          ),
        );
        return;
      }
      if (result.kind === 'in_progress') {
        next(
          AppError.conflict(
            'A request with this Idempotency-Key is already being processed',
            'IDEMPOTENCY_IN_PROGRESS',
          ),
        );
        return;
      }

      // started → capture the response body and persist the outcome
      const originalJson = res.json.bind(res);
      let capturedBody: string | null = null;
      res.json = (body: unknown): Response => {
        capturedBody = JSON.stringify(body);
        return originalJson(body);
      };
      res.on('finish', () => {
        const finalize =
          res.statusCode >= 200 && res.statusCode < 300 && capturedBody !== null
            ? store.complete(scope, key, res.statusCode, capturedBody)
            : store.release(scope, key);
        finalize.catch(() => undefined); // never break the response
      });
      next();
    })
    .catch(next);
};
