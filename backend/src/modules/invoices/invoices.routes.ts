import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const invoicesRoutes = Router();
invoicesRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner', 'Accountant');

const shapeInvoice = (recordsets: Record<string, unknown>[][]) => {
  const invoice = recordsets[0]?.[0];
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return { ...invoice, payments: recordsets[1] ?? [] };
};

/**
 * @openapi
 * /invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List invoices (tenants see their own)
 *     responses:
 *       200: { description: Paginated invoices with paid amounts }
 *   post:
 *     tags: [Invoices]
 *     summary: Create a manual invoice
 *     responses:
 *       201: { description: Invoice created }
 */
invoicesRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      apartmentId: id,
      issuedToUserId: id,
      status: Joi.string().valid('Unpaid', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'),
      invoiceType: Joi.string().valid('Rent', 'Maintenance', 'Utility', 'LateFee', 'Deposit', 'Other'),
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
      search: Joi.string().max(100),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const roles = req.user!.roles;
    const isManager =
      isAdmin(req) || roles.includes('BuildingOwner') || roles.includes('Accountant');
    const { recordset } = await execProc('sp_Invoice_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      ApartmentId: req.query.apartmentId ?? null,
      IssuedToUserId: isManager ? req.query.issuedToUserId ?? null : req.user!.userId,
      Status: req.query.status ?? null,
      InvoiceType: req.query.invoiceType ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
      Search: req.query.search ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

invoicesRoutes.post(
  '/',
  managers,
  validate({
    body: Joi.object({
      apartmentId: id.required(),
      issuedToUserId: id.required(),
      contractId: id.allow(null),
      invoiceType: Joi.string()
        .valid('Rent', 'Maintenance', 'Utility', 'LateFee', 'Deposit', 'Other')
        .default('Rent'),
      periodStart: Joi.date().iso(),
      periodEnd: Joi.date().iso(),
      dueDate: Joi.date().iso().required(),
      amount: Joi.number().positive().required(),
      notes: Joi.string().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Invoice_Create', {
      ApartmentId: req.body.apartmentId,
      IssuedToUserId: req.body.issuedToUserId,
      ContractId: req.body.contractId ?? null,
      InvoiceType: req.body.invoiceType,
      PeriodStart: req.body.periodStart ?? null,
      PeriodEnd: req.body.periodEnd ?? null,
      DueDate: req.body.dueDate,
      Amount: req.body.amount,
      Notes: req.body.notes ?? null,
    });
    const invoice = shapeInvoice(recordsets) as unknown as {
      InvoiceId: number;
      InvoiceNumber: string;
    };
    await notifyUser({
      userId: req.body.issuedToUserId,
      title: 'فاتورة جديدة | New invoice',
      body: `Invoice ${invoice.InvoiceNumber} — due ${String(req.body.dueDate).slice(0, 10)}`,
      type: 'Payment',
      entityType: 'Invoice',
      entityId: invoice.InvoiceId,
    });
    res.status(201).json({ success: true, data: invoice });
  }),
);

invoicesRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Invoice_GetById', {
      InvoiceId: Number(req.params.id),
    });
    const invoice = shapeInvoice(recordsets) as unknown as { IssuedToUserId: number };
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('BuildingOwner') ||
      roles.includes('Accountant') ||
      invoice.IssuedToUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();
    res.json({ success: true, data: invoice });
  }),
);

invoicesRoutes.post(
  '/:id/cancel',
  managers,
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Invoice_Cancel', { InvoiceId: Number(req.params.id) });
    res.json({ success: true, message: 'Invoice cancelled' });
  }),
);

/** Run the monthly rent-invoice generation batch on demand. */
invoicesRoutes.post(
  '/generate-monthly',
  managers,
  validate({ body: Joi.object({ periodStart: Joi.date().iso() }) }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc<{
      InvoiceId: number;
      InvoiceNumber: string;
      IssuedToUserId: number;
      Amount: number;
      DueDate: Date;
    }>('sp_Invoice_GenerateMonthly', { PeriodStart: req.body.periodStart ?? null });

    await Promise.all(
      recordset.map((invoice) =>
        notifyUser({
          userId: invoice.IssuedToUserId,
          title: 'فاتورة إيجار جديدة | New rent invoice',
          body: `Invoice ${invoice.InvoiceNumber} for ${invoice.Amount} JOD`,
          type: 'Payment',
          entityType: 'Invoice',
          entityId: invoice.InvoiceId,
        }),
      ),
    );
    res.json({ success: true, data: { generated: recordset.length, invoices: recordset } });
  }),
);
