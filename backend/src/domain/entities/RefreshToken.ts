export interface RefreshToken {
  id: number;
  userId: number;
  /** SHA-256 hex — the plain token is never persisted. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Rotation chain pointer, used for reuse detection. */
  replacedByTokenHash: string | null;
  createdByIp: string | null;
  createdAt: Date;
}

export interface NewRefreshToken {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  createdByIp: string | null;
}
