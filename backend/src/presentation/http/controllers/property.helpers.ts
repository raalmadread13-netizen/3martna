import { Request } from 'express';
import { TenantActor } from '@application/use-cases/property/context';
import { PageRequest } from '@shared/types';

/**
 * Caller identity for tenant-scoped operations. Routes using this MUST be
 * behind `authenticate` + `requireTenant`, which guarantee both fields.
 */
export const actorFrom = (req: Request): TenantActor => ({
  tenantId: req.user!.tenantId!,
  userId: req.user!.userId,
  ip: req.ip ?? null,
});

/** Paging values — Joi has already validated, defaulted and coerced them. */
export const pageFrom = (req: Request): PageRequest => ({
  page: Number(req.query.page ?? 1),
  pageSize: Number(req.query.pageSize ?? 20),
});
