import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const residentsRoutes = Router();
residentsRoutes.use(authenticate);

const managers = authorize('BuildingOwner');

/**
 * @openapi
 * /residents:
 *   get:
 *     tags: [Residents]
 *     summary: List residents (filter by building/apartment/type, include history)
 *     responses:
 *       200: { description: Paginated residents }
 *   post:
 *     tags: [Residents]
 *     summary: Move a resident into an apartment
 *     responses:
 *       201: { description: Resident registered }
 */
residentsRoutes.get(
  '/',
  managers,
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      apartmentId: id,
      search: Joi.string().max(150),
      residencyType: Joi.string().valid('Owner', 'Tenant', 'FamilyMember'),
      includeHistory: Joi.boolean().default(false),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Resident_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      ApartmentId: req.query.apartmentId ?? null,
      Search: req.query.search ?? null,
      ResidencyType: req.query.residencyType ?? null,
      IncludeHistory: req.query.includeHistory ?? false,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

residentsRoutes.post(
  '/',
  managers,
  validate({
    body: Joi.object({
      apartmentId: id.required(),
      userId: id.required(),
      residencyType: Joi.string().valid('Owner', 'Tenant', 'FamilyMember').required(),
      moveInDate: Joi.date().iso().required(),
      notes: Joi.string().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const resident = await execProcOne('sp_Resident_MoveIn', {
      ApartmentId: req.body.apartmentId,
      UserId: req.body.userId,
      ResidencyType: req.body.residencyType,
      MoveInDate: req.body.moveInDate,
      Notes: req.body.notes ?? null,
    });
    res.status(201).json({ success: true, data: resident });
  }),
);

/** Move-out (keeps the row as history). */
residentsRoutes.post(
  '/:id/move-out',
  managers,
  validate({
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ moveOutDate: Joi.date().iso().default(() => new Date()) }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Resident_MoveOut', {
      ResidentId: Number(req.params.id),
      MoveOutDate: req.body.moveOutDate,
    });
    res.json({ success: true, message: 'Resident moved out' });
  }),
);

/** Residency history for a user (self, or managers). */
residentsRoutes.get(
  '/history/:userId',
  validate({ params: Joi.object({ userId: id.required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    const targetId = Number(req.params.userId);
    const roles = req.user!.roles;
    if (
      targetId !== req.user!.userId &&
      !roles.includes('SystemAdmin') &&
      !roles.includes('BuildingOwner')
    ) {
      res.status(403).json({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    const { recordset } = await execProc('sp_Resident_History', { UserId: targetId });
    res.json({ success: true, data: recordset });
  }),
);
