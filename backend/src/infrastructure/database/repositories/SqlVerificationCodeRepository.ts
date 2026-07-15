import {
  NewVerificationCode,
  VerificationCode,
  VerificationPurpose,
} from '@domain/entities/VerificationCode';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { execQuery } from '@infrastructure/database/connection';

interface CodeRow {
  Id: string;
  UserId: string;
  CodeHash: string;
  Purpose: VerificationPurpose;
  ExpiresAt: Date;
  ConsumedAt: Date | null;
  AttemptCount: number;
  CreatedAt: Date;
}

export class SqlVerificationCodeRepository implements IVerificationCodeRepository {
  async createReplacingActive(code: NewVerificationCode): Promise<void> {
    await execQuery(
      `UPDATE dbo.VerificationCodes
       SET ConsumedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
       WHERE UserId = @userId AND Purpose = @purpose AND ConsumedAt IS NULL;
       INSERT INTO dbo.VerificationCodes (UserId, CodeHash, Purpose, ExpiresAt, CreatedBy)
       VALUES (@userId, @codeHash, @purpose, @expiresAt, @userId);`,
      {
        userId: code.userId,
        codeHash: code.codeHash,
        purpose: code.purpose,
        expiresAt: code.expiresAt,
      },
    );
  }

  async findActive(userId: string, purpose: VerificationPurpose): Promise<VerificationCode | null> {
    const rows = await execQuery<CodeRow>(
      `SELECT TOP 1 Id, UserId, CodeHash, Purpose, ExpiresAt, ConsumedAt, AttemptCount, CreatedAt
       FROM dbo.VerificationCodes
       WHERE UserId = @userId AND Purpose = @purpose
         AND ConsumedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
       ORDER BY CreatedAt DESC, Id DESC`,
      { userId, purpose },
    );
    const row = rows[0];
    return row
      ? {
          id: row.Id,
          userId: row.UserId,
          codeHash: row.CodeHash,
          purpose: row.Purpose,
          expiresAt: row.ExpiresAt,
          consumedAt: row.ConsumedAt,
          attemptCount: row.AttemptCount,
          createdAt: row.CreatedAt,
        }
      : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await execQuery(
      `UPDATE dbo.VerificationCodes
       SET AttemptCount = AttemptCount + 1, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`,
      { id },
    );
  }

  async consume(id: string): Promise<void> {
    await execQuery(
      `UPDATE dbo.VerificationCodes
       SET ConsumedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`,
      { id },
    );
  }
}
