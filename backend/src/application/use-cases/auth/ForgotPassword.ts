import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { generateNumericCode } from '@application/auth/codes';
import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { ITokenService } from '@application/interfaces/ITokenService';

export interface ForgotPasswordConfig {
  resetTokenTtlMinutes: number;
  /** Development convenience: echo the code in the API response. */
  revealCodes: boolean;
}

/**
 * Starts the password-reset flow. Always resolves successfully so the
 * response never reveals whether an account exists (anti-enumeration).
 */
export class ForgotPassword {
  constructor(
    private readonly users: IUserRepository,
    private readonly codes: IVerificationCodeRepository,
    private readonly tokens: ITokenService,
    private readonly email: IEmailSender,
    private readonly sms: ISmsSender,
    private readonly audit: IAuditLogRepository,
    private readonly config: ForgotPasswordConfig,
  ) {}

  async execute(identifier: string, ip: string | null): Promise<{ devCode?: string }> {
    const user = await this.users.findByEmailOrPhone(identifier);
    if (!user) return {};

    const code = generateNumericCode(6);
    await this.codes.createReplacingActive({
      userId: user.id,
      codeHash: this.tokens.hashToken(code),
      purpose: 'PasswordReset',
      expiresAt: new Date(Date.now() + this.config.resetTokenTtlMinutes * 60_000),
    });

    const message = `3martna password reset code: ${code} (valid ${this.config.resetTokenTtlMinutes} min)`;
    if (user.email) {
      await this.email.send(user.email, '3martna — Password reset', message);
    } else {
      await this.sms.send(user.phoneNumber, message);
    }

    await this.audit.write({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', ipAddress: ip });
    return this.config.revealCodes ? { devCode: code } : {};
  }
}
