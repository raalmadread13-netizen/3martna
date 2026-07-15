import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import {
  AccessTokenPayload,
  ITokenService,
  RefreshTokenBundle,
} from '@application/interfaces/ITokenService';
import { env } from '@shared/config/env';

/**
 * JWT access tokens + opaque rotating refresh tokens.
 * Refresh tokens are 256-bit random values; only their SHA-256 hash is
 * ever persisted, so a database leak cannot be replayed.
 */
export class JwtTokenService implements ITokenService {
  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign({ ...payload, type: 'access' }, env.jwt.accessSecret, {
      expiresIn: env.jwt.accessExpires,
    } as SignOptions);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, env.jwt.accessSecret) as jwt.JwtPayload;
    if (decoded.type !== 'access') throw new Error('Invalid token type');
    return {
      sub: String(decoded.sub),
      name: String(decoded.name ?? ''),
      roles: Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [],
      permissions: Array.isArray(decoded.permissions) ? (decoded.permissions as string[]) : [],
      tenantId: typeof decoded.tenantId === 'string' ? decoded.tenantId : null,
    };
  }

  generateRefreshToken(): RefreshTokenBundle {
    const token = crypto.randomBytes(32).toString('hex');
    return {
      token,
      hash: this.hashToken(token),
      expiresAt: new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000),
    };
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export const tokenService = new JwtTokenService();
