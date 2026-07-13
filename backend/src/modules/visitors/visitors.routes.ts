import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const visitorsRoutes = Router();
visitorsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const guards = authorize('SecurityGuard', 'BuildingOwner');

interface VisitorRow {
  VisitorId: number;
  HostUserId: number;
  VisitorName: string;
  QrCode: string;
  Status: string;
}

/**
 * @openapi
 * /visitors:
 *   get:
 *     tags: [Visitors]
 *     summary: List visitor passes (hosts see their own; guards see building-wide)
 *     responses:
 *       200: { description: Paginated visitors }
 *   post:
 *     tags: [Visitors]
 *     summary: Register an expected visitor (returns QR code)
 *     responses:
 *       201: { description: Visitor pass created with QR code }
 */
visitorsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      status: Joi.string().valid('Pending', 'Approved', 'Denied', 'CheckedIn', 'CheckedOut', 'Expired', 'Cancelled'),
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
      search: Joi.string().max(150),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const roles = req.user!.roles;
    const buildingWide =
      isAdmin(req) || roles.includes('SecurityGuard') || roles.includes('BuildingOwner');
    const { recordset } = await execProc('sp_Visitor_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      HostUserId: buildingWide ? null : req.user!.userId,
      Status: req.query.status ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
      Search: req.query.search ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

visitorsRoutes.post(
  '/',
  validate({
    body: Joi.object({
      apartmentId: id.required(),
      visitorName: Joi.string().min(2).max(150).required(),
      visitorPhone: Joi.string().max(20),
      visitorNationalId: Joi.string().max(20),
      vehiclePlate: Joi.string().max(20),
      purpose: Joi.string().max(200),
      expectedAt: Joi.date().iso().required(),
      expectedUntil: Joi.date().iso().greater(Joi.ref('expectedAt')),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const visitor = await execProcOne<VisitorRow>('sp_Visitor_Create', {
      ApartmentId: req.body.apartmentId,
      HostUserId: req.user!.userId,
      VisitorName: req.body.visitorName,
      VisitorPhone: req.body.visitorPhone ?? null,
      VisitorNationalId: req.body.visitorNationalId ?? null,
      VehiclePlate: req.body.vehiclePlate ?? null,
      Purpose: req.body.purpose ?? null,
      ExpectedAt: req.body.expectedAt,
      ExpectedUntil: req.body.expectedUntil ?? null,
      AutoApprove: 1, // hosts pre-approve their own visitors
    });
    res.status(201).json({ success: true, data: visitor });
  }),
);

visitorsRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const visitor = await execProcOne<VisitorRow>('sp_Visitor_GetById', {
      VisitorId: Number(req.params.id),
    });
    if (!visitor) throw ApiError.notFound('Visitor not found');
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('SecurityGuard') ||
      roles.includes('BuildingOwner') ||
      visitor.HostUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();
    res.json({ success: true, data: visitor });
  }),
);

/** Host approves/denies/cancels; guard may deny at the gate. */
visitorsRoutes.patch(
  '/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('Approved', 'Denied', 'Cancelled').required(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const existing = await execProcOne<VisitorRow>('sp_Visitor_GetById', {
      VisitorId: Number(req.params.id),
    });
    if (!existing) throw ApiError.notFound('Visitor not found');
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('SecurityGuard') ||
      roles.includes('BuildingOwner') ||
      existing.HostUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();

    const visitor = await execProcOne<VisitorRow>('sp_Visitor_UpdateStatus', {
      VisitorId: Number(req.params.id),
      Status: req.body.status,
      ActionByUserId: req.user!.userId,
    });
    res.json({ success: true, data: visitor });
  }),
);

/**
 * @openapi
 * /visitors/scan:
 *   post:
 *     tags: [Visitors]
 *     summary: Guard scans a visitor QR code — validates and checks in
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode: { type: string, format: uuid }
 *     responses:
 *       200: { description: Visitor checked in }
 *       404: { description: Invalid QR }
 *       409: { description: Not approved / expired }
 */
visitorsRoutes.post(
  '/scan',
  guards,
  validate({ body: Joi.object({ qrCode: Joi.string().uuid().required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    const visitor = await execProcOne<VisitorRow>('sp_Visitor_CheckInByQr', {
      QrCode: req.body.qrCode,
      GuardUserId: req.user!.userId,
    });
    if (visitor) {
      await notifyUser({
        userId: visitor.HostUserId,
        title: 'وصل زائرك | Your visitor arrived',
        body: visitor.VisitorName,
        type: 'Visitor',
        entityType: 'Visitor',
        entityId: visitor.VisitorId,
      });
    }
    res.json({ success: true, data: visitor });
  }),
);

visitorsRoutes.post(
  '/:id/check-out',
  guards,
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const visitor = await execProcOne('sp_Visitor_CheckOut', {
      VisitorId: Number(req.params.id),
      GuardUserId: req.user!.userId,
    });
    res.json({ success: true, data: visitor });
  }),
);
