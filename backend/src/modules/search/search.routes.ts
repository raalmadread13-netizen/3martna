import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate, isAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';

export const searchRoutes = Router();
searchRoutes.use(authenticate);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Global search across apartments, maintenance, complaints, invoices, users
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string, minLength: 2 } }
 *     responses:
 *       200: { description: Grouped results }
 */
searchRoutes.get(
  '/',
  validate({
    query: Joi.object({
      q: Joi.string().min(2).max(150).required(),
      limit: Joi.number().integer().min(1).max(20).default(5),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc<{ ResultType: string }>('sp_GlobalSearch', {
      Query: req.query.q,
      UserId: req.user!.userId,
      IsAdmin: isAdmin(req),
      MaxPerType: req.query.limit ?? 5,
    });
    const grouped: Record<string, unknown[]> = {};
    for (const row of recordset) {
      (grouped[row.ResultType] ??= []).push(row);
    }
    res.json({ success: true, data: grouped });
  }),
);
