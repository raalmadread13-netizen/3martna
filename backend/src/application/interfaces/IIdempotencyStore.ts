/**
 * Request de-duplication for POST endpoints (Sprint 5).
 *
 * A record is scoped to caller + endpoint and keyed by the client's
 * Idempotency-Key header. `begin` atomically claims the key:
 *  - 'started'      → first time seen; caller executes the request and must
 *                     finish with `complete` (2xx) or `release` (failure).
 *  - 'replay'       → a completed record exists for the same payload; the
 *                     stored response is returned, nothing re-executes.
 *  - 'in_progress'  → a concurrent request holds the key (HTTP 409).
 *  - 'mismatch'     → the key was reused with a different payload (HTTP 422).
 */
export interface IdempotencyBeginResult {
  kind: 'started' | 'replay' | 'in_progress' | 'mismatch';
  responseStatus?: number;
  responseBody?: string;
}

export interface IIdempotencyStore {
  begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBeginResult>;
  /** Store the successful response so retries replay it. */
  complete(scope: string, key: string, responseStatus: number, responseBody: string): Promise<void>;
  /** Failed execution — free the key so the client may retry. */
  release(scope: string, key: string): Promise<void>;
}
