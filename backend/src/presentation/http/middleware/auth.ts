import { NextFunction, Request, Response } from 'express';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { AppError } from '@shared/errors/AppError';

export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  roles: string[];
  /** Database-driven permission codes resolved when the token was issued. */
  permissions: string[];
  tenantId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/** Requires a valid Bearer access token and attaches req.user. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    const payload = tokenService.verifyAccessToken(header.slice(7));
    req.user = {
      userId: payload.sub,
      fullName: payload.name,
      roles: payload.roles,
      permissions: payload.permissions,
      tenantId: payload.tenantId,
    };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
  }
};

/**
 * Permission-based authorization. Permission codes live in the database
 * (dbo.Permissions) and are resolved into the access token at issue time —
 * nothing is hardcoded here beyond the code being checked.
 */
export const requirePermission =
  (...codes: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    const granted = req.user.permissions;
    if (codes.every((code) => granted.includes(code))) {
      next();
      return;
    }
    next(AppError.forbidden());
  };

/**
 * Tenant-scoped endpoints require the caller to belong to a tenant. The
 * tenantId is read from the verified token only — never from client input —
 * so downstream code can trust req.user.tenantId as the isolation boundary.
 * Platform-level accounts (tenantId = null) must be assigned to a tenant
 * before they can manage tenant data.
 */
export const requireTenant = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (!req.user.tenantId) {
    next(AppError.forbidden('This operation requires a tenant context', 'TENANT_CONTEXT_REQUIRED'));
    return;
  }
  next();
};

/** Role-based guard — kept for coarse checks; prefer requirePermission. */
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
