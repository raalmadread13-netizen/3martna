import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const auditRoutes = Router();
auditRoutes.use(authenticate, authorize('SystemAdmin'));

/**
 * @openapi
 * /audit:
 *   get:
 *     tags: [Audit]
 *     summary: Audit trail (admin only)
 *     responses:
 *       200: { description: Paginated audit records }
 */
auditRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      userId: id,
      action: Joi.string().max(50),
      entityType: Joi.string().max(50),
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Audit_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      UserId: req.query.userId ?? null,
      Action: req.query.action ?? null,
      EntityType: req.query.entityType ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);
