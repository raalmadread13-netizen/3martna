import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/tokens';
import { RoleName } from '../types';

/** Require a valid Bearer access token; attaches req.user. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized());
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { userId: payload.sub, fullName: payload.name, roles: payload.roles };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
  }
};

/** Require one of the given roles. SystemAdmin always passes. */
export const authorize =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    const userRoles = req.user.roles;
    if (userRoles.includes('SystemAdmin') || roles.some((role) => userRoles.includes(role))) {
      next();
      return;
    }
    next(ApiError.forbidden());
  };

export const isAdmin = (req: Request): boolean => req.user?.roles.includes('SystemAdmin') ?? false;
