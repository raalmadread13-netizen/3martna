import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { ITokenService } from '@application/interfaces/ITokenService';

export class LogoutUser {
  constructor(
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly tokens: ITokenService,
    private readonly audit: IAuditLogRepository,
  ) {}

  /** Revokes the presented refresh token. Idempotent by design. */
  async execute(userId: number, refreshToken: string, ip: string | null): Promise<void> {
    await this.refreshTokens.revoke(this.tokens.hashToken(refreshToken));
    await this.audit.write({ userId, action: 'LOGOUT', ipAddress: ip });
  }
}
