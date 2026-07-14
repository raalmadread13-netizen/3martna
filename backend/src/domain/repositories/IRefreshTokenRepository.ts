import { NewRefreshToken, RefreshToken } from '@domain/entities/RefreshToken';

export interface IRefreshTokenRepository {
  create(token: NewRefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  revoke(tokenHash: string, replacedByTokenHash?: string | null): Promise<void>;
  /** Global sign-out: password change, suspected token theft, account disable. */
  revokeAllForUser(userId: number): Promise<void>;
}
