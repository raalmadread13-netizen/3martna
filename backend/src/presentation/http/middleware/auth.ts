import { NextFunction, Request, Response } from 'express';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { AppError } from '@shared/errors/AppError';

export interface AuthenticatedUser {
  userId: number;
  fullName: string;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * JWT authentication structure — ready for the auth feature sprint.
 * Requires a valid Bearer access token and attaches req.user.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    const payload = tokenService.verifyAccessToken(header.slice(7));
    req.user = { userId: payload.sub, fullName: payload.name, roles: payload.roles };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
  }
};

/** Role-based authorization guard. */
export const authorize =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (roles.length === 0 || roles.some((role) => req.user!.roles.includes(role))) {
      next();
      return;
    }
    next(AppError.forbidden());
  };
