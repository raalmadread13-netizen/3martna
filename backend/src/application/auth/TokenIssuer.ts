import { User } from '@domain/entities/User';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { ITokenService } from '@application/interfaces/ITokenService';
import { UserAuthorization } from '@domain/entities/Role';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues an access/refresh token pair for a user.
 * Permissions are resolved from the database at issue time, so the
 * short-lived access token always carries a fresh authorization set.
 */
export class TokenIssuer {
  constructor(
    private readonly tokens: ITokenService,
    private readonly roles: IRoleRepository,
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  async authorizationFor(userId: string): Promise<UserAuthorization> {
    return this.roles.getUserAuthorization(userId);
  }

  async issue(
    user: User,
    ip: string | null,
  ): Promise<{ pair: TokenPair; auth: UserAuthorization }> {
    const auth = await this.roles.getUserAuthorization(user.id);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      name: `${user.firstName} ${user.lastName}`,
      roles: auth.roles,
      permissions: auth.permissions,
      tenantId: user.tenantId,
    });
    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      createdByIp: ip,
    });
    return { pair: { accessToken, refreshToken: refresh.token }, auth };
  }
}
