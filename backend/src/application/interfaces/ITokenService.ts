export interface AccessTokenPayload {
  /** User id. */
  sub: number;
  /** Display name (for logs/telemetry, not authorization). */
  name: string;
  /** Role names used by the authorization middleware. */
  roles: string[];
}

export interface RefreshTokenBundle {
  /** Opaque token handed to the client. */
  token: string;
  /** SHA-256 of the token — the only thing ever persisted. */
  hash: string;
  expiresAt: Date;
}

/** Token contract — implemented with jsonwebtoken + crypto in infrastructure. */
export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(): RefreshTokenBundle;
  hashToken(token: string): string;
}
