import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { MAX_CODE_ATTEMPTS } from '@application/auth/codes';
import { checkPasswordPolicy } from '@application/auth/passwordPolicy';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { ITokenService } from '@application/interfaces/ITokenService';
import { AppError } from '@shared/errors/AppError';

/** Generic failure — identical for unknown user, bad code and expiry. */
const invalidCode = (): AppError =>
  AppError.badRequest('Invalid or expired reset code', 'INVALID_RESET_CODE');

export class ResetPassword {
  constructor(
    private readonly users: IUserRepository,
    private readonly codes: IVerificationCodeRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(
    identifier: string,
    code: string,
    newPassword: string,
    ip: string | null,
  ): Promise<void> {
    const user = await this.users.findByEmailOrPhone(identifier);
    if (!user) throw invalidCode();

    const active = await this.codes.findActive(user.id, 'PasswordReset');
    if (!active) throw invalidCode();

    if (active.attemptCount >= MAX_CODE_ATTEMPTS) {
      await this.codes.consume(active.id);
      throw invalidCode();
    }
    if (active.codeHash !== this.tokens.hashToken(code)) {
      await this.codes.incrementAttempts(active.id);
      throw invalidCode();
    }

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.valid) {
      throw AppError.badRequest(
        'Password does not meet the policy',
        'WEAK_PASSWORD',
        policy.failures,
      );
    }

    await this.codes.consume(active.id);
    await this.users.setPasswordHash(user.id, await this.hasher.hash(newPassword), user.id);
    // Resetting the password signs the user out everywhere
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.audit.write({ userId: user.id, action: 'PASSWORD_RESET', ipAddress: ip });
  }
}
