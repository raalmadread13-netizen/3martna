import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { MAX_CODE_ATTEMPTS } from '@application/auth/codes';
import { ITokenService } from '@application/interfaces/ITokenService';
import { AppError } from '@shared/errors/AppError';
import { VerificationChannel } from './RequestVerification';

const invalidCode = (): AppError =>
  AppError.badRequest('Invalid or expired verification code', 'INVALID_VERIFICATION_CODE');

/** Confirms a 6-digit code and marks the email/phone as verified. */
export class ConfirmVerification {
  constructor(
    private readonly users: IUserRepository,
    private readonly codes: IVerificationCodeRepository,
    private readonly tokens: ITokenService,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(userId: number, channel: VerificationChannel, code: string): Promise<void> {
    const purpose = channel === 'email' ? 'EmailVerify' : 'PhoneVerify';
    const active = await this.codes.findActive(userId, purpose);
    if (!active) throw invalidCode();

    if (active.attemptCount >= MAX_CODE_ATTEMPTS) {
      await this.codes.consume(active.id);
      throw invalidCode();
    }
    if (active.codeHash !== this.tokens.hashToken(code)) {
      await this.codes.incrementAttempts(active.id);
      throw invalidCode();
    }

    await this.codes.consume(active.id);
    if (channel === 'email') {
      await this.users.setEmailVerified(userId);
    } else {
      await this.users.setPhoneVerified(userId);
    }
    await this.audit.write({
      userId,
      action: channel === 'email' ? 'EMAIL_VERIFIED' : 'PHONE_VERIFIED',
    });
  }
}
