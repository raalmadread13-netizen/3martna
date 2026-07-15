import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { generateNumericCode } from '@application/auth/codes';
import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { ITokenService } from '@application/interfaces/ITokenService';
import { AppError } from '@shared/errors/AppError';

export type VerificationChannel = 'email' | 'phone';

export interface VerificationConfig {
  codeTtlMinutes: number;
  /** Development convenience: echo the code in the API response. */
  revealCodes: boolean;
}

/** Sends a 6-digit verification code to the user's email or phone. */
export class RequestVerification {
  constructor(
    private readonly users: IUserRepository,
    private readonly codes: IVerificationCodeRepository,
    private readonly tokens: ITokenService,
    private readonly email: IEmailSender,
    private readonly sms: ISmsSender,
    private readonly audit: IAuditLogRepository,
    private readonly config: VerificationConfig,
  ) {}

  async execute(userId: string, channel: VerificationChannel): Promise<{ devCode?: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();

    if (channel === 'email') {
      if (!user.email) throw AppError.badRequest('No email on this account', 'NO_EMAIL_ON_ACCOUNT');
      if (user.emailVerified) {
        throw AppError.badRequest('Email is already verified', 'ALREADY_VERIFIED');
      }
    } else if (user.phoneVerified) {
      throw AppError.badRequest('Phone is already verified', 'ALREADY_VERIFIED');
    }

    const code = generateNumericCode(6);
    await this.codes.createReplacingActive({
      userId,
      codeHash: this.tokens.hashToken(code),
      purpose: channel === 'email' ? 'EmailVerify' : 'PhoneVerify',
      expiresAt: new Date(Date.now() + this.config.codeTtlMinutes * 60_000),
    });

    const message = `3martna verification code: ${code} (valid ${this.config.codeTtlMinutes} min)`;
    if (channel === 'email') {
      await this.email.send(user.email!, '3martna — Verify your email', message);
    } else {
      await this.sms.send(user.phoneNumber, message);
    }

    await this.audit.write({
      userId,
      action: 'VERIFICATION_REQUESTED',
      metadata: { channel },
    });
    return this.config.revealCodes ? { devCode: code } : {};
  }
}
