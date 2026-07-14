export interface AccessTokenPayload {
  /** User id. */
  sub: number;
  /** Display name (for logs/telemetry, not authorization). */
  name: string;
  /** Role names. */
  roles: string[];
  /** Database-driven permission codes resolved at issue time. */
  permissions: string[];
  /** Multi-tenant readiness — null until the Tenants feature lands. */
  tenantId: number | null;
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
