import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { TokenPair } from '@application/auth/TokenIssuer';
import { ITokenService } from '@application/interfaces/ITokenService';
import { AppError } from '@shared/errors/AppError';

const invalidToken = (): AppError =>
  AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

/**
 * Refresh-token rotation with reuse detection: presenting an
 * already-revoked token is treated as theft and revokes every session
 * belonging to that user.
 */
export class RefreshSession {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly tokens: ITokenService,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(refreshToken: string, ip: string | null): Promise<TokenPair> {
    const hash = this.tokens.hashToken(refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (!record) throw invalidToken();

    if (record.revokedAt) {
      await this.refreshTokens.revokeAllForUser(record.userId);
      await this.audit.write({
        userId: record.userId,
        action: 'TOKEN_REUSE_DETECTED',
        ipAddress: ip,
        metadata: { rotatedInto: record.replacedByTokenHash ? 'yes' : 'no' },
      });
      throw invalidToken();
    }
    if (record.expiresAt.getTime() <= Date.now()) throw invalidToken();

    const user = await this.users.findById(record.userId);
    if (!user || user.isDeleted || user.status !== 'Active') throw invalidToken();

    // Rotate: revoke the presented token, chain it to its replacement
    const next = this.tokens.generateRefreshToken();
    await this.refreshTokens.revoke(hash, next.hash);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: next.hash,
      expiresAt: next.expiresAt,
      createdByIp: ip,
    });

    const auth = await this.roles.getUserAuthorization(user.id);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      name: `${user.firstName} ${user.lastName}`,
      roles: auth.roles,
      permissions: auth.permissions,
      tenantId: user.tenantId,
    });

    return { accessToken, refreshToken: next.token };
  }
}
