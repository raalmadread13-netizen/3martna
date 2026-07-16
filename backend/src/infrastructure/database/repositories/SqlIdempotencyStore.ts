import {
  IIdempotencyStore,
  IdempotencyBeginResult,
} from '@application/interfaces/IIdempotencyStore';
import { execQuery } from '@infrastructure/database/connection';

interface KeyRow {
  RequestHash: string;
  Status: 'InProgress' | 'Completed';
  ResponseStatus: number | null;
  ResponseBody: string | null;
}

const TTL_HOURS = 24;
/** SQL Server duplicate-key error numbers (unique index / constraint). */
const DUPLICATE_KEY_ERRORS = new Set([2601, 2627]);

/**
 * SQL Server implementation of the idempotency store (dbo.IdempotencyKeys).
 * The unique (Scope, IdemKey) index makes `begin` race-safe: concurrent
 * inserts collide and the loser reads the winner's row.
 */
export class SqlIdempotencyStore implements IIdempotencyStore {
  async begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBeginResult> {
    // Opportunistic cleanup — expired keys may be reused
    await execQuery(`DELETE FROM dbo.IdempotencyKeys WHERE ExpiresAt < SYSUTCDATETIME()`);

    try {
      await execQuery(
        `INSERT INTO dbo.IdempotencyKeys (Scope, IdemKey, RequestHash, Status, ExpiresAt)
         VALUES (@scope, @key, @requestHash, 'InProgress', DATEADD(HOUR, @ttl, SYSUTCDATETIME()))`,
        { scope, key, requestHash, ttl: TTL_HOURS },
      );
      return { kind: 'started' };
    } catch (error) {
      if (!DUPLICATE_KEY_ERRORS.has((error as { number?: number }).number ?? 0)) throw error;
    }

    const rows = await execQuery<KeyRow>(
      `SELECT RequestHash, Status, ResponseStatus, ResponseBody
       FROM dbo.IdempotencyKeys WHERE Scope = @scope AND IdemKey = @key`,
      { scope, key },
    );
    const existing = rows[0];
    if (!existing) return { kind: 'in_progress' }; // deleted between insert & read — retry later
    if (existing.RequestHash !== requestHash) return { kind: 'mismatch' };
    if (existing.Status === 'InProgress') return { kind: 'in_progress' };
    return {
      kind: 'replay',
      responseStatus: existing.ResponseStatus ?? 200,
      responseBody: existing.ResponseBody ?? '{}',
    };
  }

  async complete(
    scope: string,
    key: string,
    responseStatus: number,
    responseBody: string,
  ): Promise<void> {
    await execQuery(
      `UPDATE dbo.IdempotencyKeys
       SET Status = 'Completed', ResponseStatus = @responseStatus, ResponseBody = @responseBody
       WHERE Scope = @scope AND IdemKey = @key`,
      { scope, key, responseStatus, responseBody },
    );
  }

  async release(scope: string, key: string): Promise<void> {
    await execQuery(
      `DELETE FROM dbo.IdempotencyKeys
       WHERE Scope = @scope AND IdemKey = @key AND Status = 'InProgress'`,
      { scope, key },
    );
  }
}
