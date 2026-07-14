import { NewRefreshToken, RefreshToken } from '@domain/entities/RefreshToken';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { execQuery } from '@infrastructure/database/connection';

interface TokenRow {
  Id: number;
  UserId: number;
  TokenHash: string;
  ExpiresAt: Date;
  RevokedAt: Date | null;
  ReplacedByTokenHash: string | null;
  CreatedByIp: string | null;
  CreatedAt: Date;
}

export class SqlRefreshTokenRepository implements IRefreshTokenRepository {
  async create(token: NewRefreshToken): Promise<void> {
    await execQuery(
      `INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, CreatedByIp, CreatedBy)
       VALUES (@userId, @tokenHash, @expiresAt, @createdByIp, @userId)`,
      {
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        createdByIp: token.createdByIp,
      },
    );
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const rows = await execQuery<TokenRow>(
      `SELECT Id, UserId, TokenHash, ExpiresAt, RevokedAt, ReplacedByTokenHash, CreatedByIp, CreatedAt
       FROM dbo.RefreshTokens WHERE TokenHash = @tokenHash`,
      { tokenHash },
    );
    const row = rows[0];
    return row
      ? {
          id: row.Id,
          userId: row.UserId,
          tokenHash: row.TokenHash,
          expiresAt: row.ExpiresAt,
          revokedAt: row.RevokedAt,
          replacedByTokenHash: row.ReplacedByTokenHash,
          createdByIp: row.CreatedByIp,
          createdAt: row.CreatedAt,
        }
      : null;
  }

  async revoke(tokenHash: string, replacedByTokenHash: string | null = null): Promise<void> {
    await execQuery(
      `UPDATE dbo.RefreshTokens
       SET RevokedAt = SYSUTCDATETIME(), ReplacedByTokenHash = @replacedByTokenHash,
           UpdatedAt = SYSUTCDATETIME()
       WHERE TokenHash = @tokenHash AND RevokedAt IS NULL`,
      { tokenHash, replacedByTokenHash },
    );
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await execQuery(
      `UPDATE dbo.RefreshTokens
       SET RevokedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
       WHERE UserId = @userId AND RevokedAt IS NULL`,
      { userId },
    );
  }
}
