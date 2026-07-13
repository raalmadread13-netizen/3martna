import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { assertBuildingAccess } from '../buildings/buildings.controller';

export const expensesRoutes = Router();
expensesRoutes.use(authenticate, authorize('BuildingOwner', 'Accountant'));

/**
 * @openapi
 * /expenses:
 *   get:
 *     tags: [Expenses]
 *     summary: List building expenses
 *     responses:
 *       200: { description: Paginated expenses }
 *   post:
 *     tags: [Expenses]
 *     summary: Record a building expense
 *     responses:
 *       201: { description: Expense recorded }
 */
expensesRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      categoryId: id,
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Expense_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      CategoryId: req.query.categoryId ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

expensesRoutes.post(
  '/',
  validate({
    body: Joi.object({
      buildingId: id.required(),
      categoryId: id.required(),
      amount: Joi.number().positive().required(),
      expenseDate: Joi.date().iso().required(),
      description: Joi.string().max(500),
      vendorName: Joi.string().max(150),
      receiptUrl: Joi.string().uri().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await assertBuildingAccess(req.body.buildingId, req);
    const expense = await execProcOne('sp_Expense_Create', {
      BuildingId: req.body.buildingId,
      CategoryId: req.body.categoryId,
      Amount: req.body.amount,
      ExpenseDate: req.body.expenseDate,
      Description: req.body.description ?? null,
      VendorName: req.body.vendorName ?? null,
      ReceiptUrl: req.body.receiptUrl ?? null,
      CreatedByUserId: req.user!.userId,
    });
    res.status(201).json({ success: true, data: expense });
  }),
);

expensesRoutes.get(
  '/categories',
  catchAsync(async (_req: Request, res: Response) => {
    const { recordset } = await execProc('sp_ExpenseCategory_List');
    res.json({ success: true, data: recordset });
  }),
);

expensesRoutes.delete(
  '/:id',
  validate({ params: Joi.object({ id: id.required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Expense_Delete', { ExpenseId: Number(req.params.id) });
    res.json({ success: true, message: 'Expense deleted' });
  }),
);
