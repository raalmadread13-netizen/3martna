import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const contractsRoutes = Router();
contractsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner', 'Accountant');

/**
 * @openapi
 * /contracts:
 *   get:
 *     tags: [Contracts]
 *     summary: List rental contracts (tenants see their own)
 *     responses:
 *       200: { description: Paginated contracts }
 *   post:
 *     tags: [Contracts]
 *     summary: Create a rental contract
 *     responses:
 *       201: { description: Contract created }
 */
contractsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      apartmentId: id,
      tenantUserId: id,
      status: Joi.string().valid('Pending', 'Active', 'Expired', 'Terminated'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const roles = req.user!.roles;
    const isManager =
      isAdmin(req) || roles.includes('BuildingOwner') || roles.includes('Accountant');
    const { recordset } = await execProc('sp_Contract_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      ApartmentId: req.query.apartmentId ?? null,
      // Tenants are always scoped to their own contracts
      TenantUserId: isManager ? req.query.tenantUserId ?? null : req.user!.userId,
      LandlordUserId: !isAdmin(req) && roles.includes('BuildingOwner') ? req.user!.userId : null,
      Status: req.query.status ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

contractsRoutes.post(
  '/',
  managers,
  validate({
    body: Joi.object({
      apartmentId: id.required(),
      tenantUserId: id.required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
      monthlyRent: Joi.number().positive().required(),
      depositAmount: Joi.number().min(0).default(0),
      paymentFrequency: Joi.string().valid('Monthly', 'Quarterly', 'SemiAnnual', 'Annual').default('Monthly'),
      lateFeePercent: Joi.number().min(0).max(100).default(0),
      graceDays: Joi.number().integer().min(0).max(30).default(5),
      documentUrl: Joi.string().uri().max(500),
      activateNow: Joi.boolean().default(false),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const contract = await execProcOne<{ ContractId: number; TenantUserId: number }>(
      'sp_Contract_Create',
      {
        ApartmentId: req.body.apartmentId,
        TenantUserId: req.body.tenantUserId,
        LandlordUserId: req.user!.userId,
        StartDate: req.body.startDate,
        EndDate: req.body.endDate,
        MonthlyRent: req.body.monthlyRent,
        DepositAmount: req.body.depositAmount,
        PaymentFrequency: req.body.paymentFrequency,
        LateFeePercent: req.body.lateFeePercent,
        GraceDays: req.body.graceDays,
        DocumentUrl: req.body.documentUrl ?? null,
        ActivateNow: req.body.activateNow,
      },
    );
    if (contract) {
      await notifyUser({
        userId: contract.TenantUserId,
        title: 'عقد إيجار جديد | New rental contract',
        body: 'A rental contract has been created for you',
        type: 'Contract',
        entityType: 'Contract',
        entityId: contract.ContractId,
      });
    }
    res.status(201).json({ success: true, data: contract });
  }),
);

contractsRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const contract = await execProcOne<{ TenantUserId: number; LandlordUserId: number }>(
      'sp_Contract_GetById',
      { ContractId: Number(req.params.id) },
    );
    if (!contract) throw ApiError.notFound('Contract not found');
    const roles = req.user!.roles;
    const allowed =
      isAdmin(req) ||
      roles.includes('Accountant') ||
      contract.TenantUserId === req.user!.userId ||
      contract.LandlordUserId === req.user!.userId;
    if (!allowed) throw ApiError.forbidden();
    res.json({ success: true, data: contract });
  }),
);

contractsRoutes.post(
  '/:id/activate',
  managers,
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const contract = await execProcOne('sp_Contract_Activate', {
      ContractId: Number(req.params.id),
    });
    res.json({ success: true, data: contract });
  }),
);

contractsRoutes.post(
  '/:id/terminate',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      reason: Joi.string().max(500),
      moveOutDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const contract = await execProcOne('sp_Contract_Terminate', {
      ContractId: Number(req.params.id),
      Reason: req.body.reason ?? null,
      MoveOutDate: req.body.moveOutDate ?? null,
    });
    res.json({ success: true, data: contract });
  }),
);
