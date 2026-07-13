import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { buildReceiptPdf } from '../../utils/receiptPdf';

export const paymentsRoutes = Router();
paymentsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner', 'Accountant');

interface PaymentRow {
  PaymentId: number;
  InvoiceNumber: string;
  PaidByUserId: number;
  PaidByName: string;
  BuildingName: string;
  ApartmentNumber: string;
  Amount: number;
  Method: string;
  Status: string;
  ReferenceNumber: string | null;
  ReceiptNumber: string | null;
  PaidAt: Date;
}

/**
 * @openapi
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Payment history (tenants see their own)
 *     responses:
 *       200: { description: Paginated payments }
 *   post:
 *     tags: [Payments]
 *     summary: Record a payment against an invoice (auto-generates a receipt)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceId, amount, method]
 *             properties:
 *               invoiceId: { type: integer }
 *               amount: { type: number }
 *               method: { type: string, enum: [Cash, BankTransfer, CreditCard] }
 *               referenceNumber: { type: string }
 *     responses:
 *       201: { description: Payment recorded }
 *       400: { description: Amount exceeds balance }
 */
paymentsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      paidByUserId: id,
      method: Joi.string().valid('Cash', 'BankTransfer', 'CreditCard'),
      status: Joi.string().valid('Pending', 'Confirmed', 'Rejected'),
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const roles = req.user!.roles;
    const isManager =
      isAdmin(req) || roles.includes('BuildingOwner') || roles.includes('Accountant');
    const { recordset } = await execProc('sp_Payment_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      PaidByUserId: isManager ? req.query.paidByUserId ?? null : req.user!.userId,
      Method: req.query.method ?? null,
      Status: req.query.status ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

paymentsRoutes.post(
  '/',
  validate({
    body: Joi.object({
      invoiceId: id.required(),
      amount: Joi.number().positive().required(),
      method: Joi.string().valid('Cash', 'BankTransfer', 'CreditCard').required(),
      referenceNumber: Joi.string().max(100),
      paidByUserId: id, // managers may record on behalf of a tenant
      notes: Joi.string().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const roles = req.user!.roles;
    const isManager =
      isAdmin(req) || roles.includes('BuildingOwner') || roles.includes('Accountant');

    // Tenants self-report bank transfers as Pending until confirmed;
    // managers record confirmed payments directly.
    const payment = await execProcOne<PaymentRow>('sp_Payment_Record', {
      InvoiceId: req.body.invoiceId,
      PaidByUserId: isManager && req.body.paidByUserId ? req.body.paidByUserId : req.user!.userId,
      Amount: req.body.amount,
      Method: req.body.method,
      ReferenceNumber: req.body.referenceNumber ?? null,
      ReceivedByUserId: isManager ? req.user!.userId : null,
      Notes: req.body.notes ?? null,
      Status: isManager ? 'Confirmed' : 'Pending',
    });
    if (!payment) throw ApiError.internal('Payment failed');

    if (payment.Status === 'Confirmed') {
      await notifyUser({
        userId: payment.PaidByUserId,
        title: 'تم استلام الدفعة | Payment received',
        body: `${payment.Amount} JOD — receipt ${payment.ReceiptNumber ?? ''}`,
        type: 'Payment',
        entityType: 'Payment',
        entityId: payment.PaymentId,
      });
    }
    res.status(201).json({ success: true, data: payment });
  }),
);

paymentsRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const payment = await execProcOne<PaymentRow>('sp_Payment_GetById', {
      PaymentId: Number(req.params.id),
    });
    if (!payment) throw ApiError.notFound('Payment not found');
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('BuildingOwner') ||
      roles.includes('Accountant') ||
      payment.PaidByUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();
    res.json({ success: true, data: payment });
  }),
);

/** Confirm or reject a pending payment (e.g. bank transfer review). */
paymentsRoutes.patch(
  '/:id/status',
  managers,
  validate({
    params: idParam,
    body: Joi.object({ status: Joi.string().valid('Confirmed', 'Rejected').required() }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const payment = await execProcOne<PaymentRow>('sp_Payment_UpdateStatus', {
      PaymentId: Number(req.params.id),
      Status: req.body.status,
    });
    if (payment && req.body.status === 'Confirmed') {
      await notifyUser({
        userId: payment.PaidByUserId,
        title: 'تم تأكيد الدفعة | Payment confirmed',
        body: `${payment.Amount} JOD — receipt ${payment.ReceiptNumber ?? ''}`,
        type: 'Payment',
        entityType: 'Payment',
        entityId: payment.PaymentId,
      });
    }
    res.json({ success: true, data: payment });
  }),
);

/**
 * @openapi
 * /payments/{id}/receipt:
 *   get:
 *     tags: [Payments]
 *     summary: Download the PDF receipt for a confirmed payment
 *     responses:
 *       200:
 *         description: PDF receipt
 *         content:
 *           application/pdf: {}
 */
paymentsRoutes.get(
  '/:id/receipt',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const payment = await execProcOne<PaymentRow>('sp_Payment_GetById', {
      PaymentId: Number(req.params.id),
    });
    if (!payment) throw ApiError.notFound('Payment not found');
    if (!payment.ReceiptNumber) throw ApiError.badRequest('Payment has no receipt yet');
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('BuildingOwner') ||
      roles.includes('Accountant') ||
      payment.PaidByUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();

    const pdf = await buildReceiptPdf({
      receiptNumber: payment.ReceiptNumber,
      invoiceNumber: payment.InvoiceNumber,
      paidByName: payment.PaidByName,
      buildingName: payment.BuildingName,
      apartmentNumber: payment.ApartmentNumber,
      amount: Number(payment.Amount),
      method: payment.Method,
      paidAt: new Date(payment.PaidAt),
      referenceNumber: payment.ReferenceNumber,
    });
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${payment.ReceiptNumber}.pdf"`)
      .send(pdf);
  }),
);
