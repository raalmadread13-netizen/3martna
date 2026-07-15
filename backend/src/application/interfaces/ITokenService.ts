export interface AccessTokenPayload {
  /** User id (GUID). */
  sub: string;
  /** Display name (for logs/telemetry, not authorization). */
  name: string;
  /** Role names. */
  roles: string[];
  /** Database-driven permission codes resolved at issue time. */
  permissions: string[];
  /** Tenant id (GUID) — null for platform-level users. */
  tenantId: string | null;
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
