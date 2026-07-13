import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { RoleName } from '../types';

export interface AccessTokenPayload {
  sub: number;
  name: string;
  roles: RoleName[];
  type: 'access';
}

export const signAccessToken = (userId: number, name: string, roles: RoleName[]): string =>
  jwt.sign(
    { sub: userId, name, roles, type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires } as SignOptions,
  );

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.jwt.accessSecret) as jwt.JwtPayload;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return {
    sub: Number(decoded.sub),
    name: String(decoded.name),
    roles: (decoded.roles ?? []) as RoleName[],
    type: 'access',
  };
};

/** Opaque refresh token: random 256-bit value; only its SHA-256 is stored. */
export const generateRefreshToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000),
  };
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateResetToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
};
