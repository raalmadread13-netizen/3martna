import crypto from 'crypto';
import { NewUser, User } from '@domain/entities/User';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { execQuery } from '@infrastructure/database/connection';

interface UserRow {
  Id: string;
  TenantId: string | null;
  FirstName: string;
  LastName: string;
  Email: string | null;
  PhoneNumber: string;
  PasswordHash: string;
  ProfileImageUrl: string | null;
  PreferredLanguage: 'ar' | 'en';
  Status: 'Active' | 'Suspended';
  EmailVerified: boolean;
  PhoneVerified: boolean;
  LastLoginAt: Date | null;
  FailedLoginCount: number;
  LockedUntil: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  IsDeleted: boolean;
}

const COLUMNS = `Id, TenantId, FirstName, LastName, Email, PhoneNumber, PasswordHash,
  ProfileImageUrl, PreferredLanguage, Status, EmailVerified, PhoneVerified, LastLoginAt,
  FailedLoginCount, LockedUntil, CreatedAt, UpdatedAt, IsDeleted`;

const mapUser = (row: UserRow): User => ({
  id: row.Id,
  tenantId: row.TenantId,
  firstName: row.FirstName,
  lastName: row.LastName,
  email: row.Email,
  phoneNumber: row.PhoneNumber,
  passwordHash: row.PasswordHash,
  profileImageUrl: row.ProfileImageUrl,
  preferredLanguage: row.PreferredLanguage,
  status: row.Status,
  emailVerified: row.EmailVerified,
  phoneVerified: row.PhoneVerified,
  lastLoginAt: row.LastLoginAt,
  failedLoginCount: row.FailedLoginCount,
  lockedUntil: row.LockedUntil,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  isDeleted: row.IsDeleted,
});

/**
 * SQL Server implementation. Every statement is fully parameterized —
 * the driver binds values, no string interpolation ever reaches SQL.
 * Ids are GUIDs generated app-side (crypto.randomUUID) so the entity id
 * is known before the INSERT round-trip.
 */
export class SqlUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const rows = await execQuery<UserRow>(
      `SELECT ${COLUMNS} FROM dbo.Users WHERE Id = @id AND IsDeleted = 0`,
      { id },
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    const rows = await execQuery<UserRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Users
       WHERE (Email = @identifier OR PhoneNumber = @identifier) AND IsDeleted = 0`,
      { identifier },
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.Users WHERE Email = @email AND IsDeleted = 0`,
      { email },
    );
    return rows.length > 0;
  }

  async phoneExists(phoneNumber: string): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.Users WHERE PhoneNumber = @phoneNumber AND IsDeleted = 0`,
      { phoneNumber },
    );
    return rows.length > 0;
  }

  async create(user: NewUser): Promise<User> {
    const id = crypto.randomUUID();
    const rows = await execQuery<UserRow>(
      `INSERT INTO dbo.Users
         (Id, FirstName, LastName, Email, PhoneNumber, PasswordHash, PreferredLanguage, CreatedBy)
       VALUES (@id, @firstName, @lastName, @email, @phoneNumber, @passwordHash, @preferredLanguage, @createdBy);
       SELECT ${COLUMNS} FROM dbo.Users WHERE Id = @id;`,
      {
        id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        passwordHash: user.passwordHash,
        preferredLanguage: user.preferredLanguage,
        createdBy: user.createdBy,
      },
    );
    return mapUser(rows[0]);
  }

  async setPasswordHash(
    userId: string,
    passwordHash: string,
    updatedBy: string | null,
  ): Promise<void> {
    await execQuery(
      `UPDATE dbo.Users
       SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
       WHERE Id = @userId AND IsDeleted = 0`,
      { userId, passwordHash, updatedBy },
    );
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    await execQuery(
      `UPDATE dbo.Users
       SET LastLoginAt = SYSUTCDATETIME(), FailedLoginCount = 0, LockedUntil = NULL,
           UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @userId`,
      { userId },
    );
  }

  async recordLoginFailure(
    userId: string,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<void> {
    // Threshold hit → lock the account and reset the counter
    await execQuery(
      `UPDATE dbo.Users SET
         LockedUntil = CASE WHEN FailedLoginCount + 1 >= @maxAttempts
                            THEN DATEADD(MINUTE, @lockMinutes, SYSUTCDATETIME())
                            ELSE LockedUntil END,
         FailedLoginCount = CASE WHEN FailedLoginCount + 1 >= @maxAttempts
                                 THEN 0 ELSE FailedLoginCount + 1 END,
         UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @userId`,
      { userId, maxAttempts, lockMinutes },
    );
  }

  async setEmailVerified(userId: string): Promise<void> {
    await execQuery(
      `UPDATE dbo.Users SET EmailVerified = 1, UpdatedAt = SYSUTCDATETIME() WHERE Id = @userId`,
      { userId },
    );
  }

  async setPhoneVerified(userId: string): Promise<void> {
    await execQuery(
      `UPDATE dbo.Users SET PhoneVerified = 1, UpdatedAt = SYSUTCDATETIME() WHERE Id = @userId`,
      { userId },
    );
  }
}
