import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { checkPasswordPolicy } from '@application/auth/passwordPolicy';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppError } from '@shared/errors/AppError';

export class ChangePassword {
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(
    userId: number,
    currentPassword: string,
    newPassword: string,
    ip: string | null,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();

    if (!(await this.hasher.compare(currentPassword, user.passwordHash))) {
      throw AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.valid) {
      throw AppError.badRequest(
        'Password does not meet the policy',
        'WEAK_PASSWORD',
        policy.failures,
      );
    }

    await this.users.setPasswordHash(userId, await this.hasher.hash(newPassword), userId);
    // A password change invalidates every existing session
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.write({ userId, action: 'PASSWORD_CHANGED', ipAddress: ip });
  }
}
