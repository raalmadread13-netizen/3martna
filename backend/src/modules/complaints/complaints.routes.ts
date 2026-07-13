import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const complaintsRoutes = Router();
complaintsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner');

const shapeComplaint = (recordsets: Record<string, unknown>[][], includeInternal: boolean) => {
  const complaint = recordsets[0]?.[0];
  if (!complaint) throw ApiError.notFound('Complaint not found');
  const comments = (recordsets[1] ?? []).filter(
    (comment) => includeInternal || !(comment as { IsInternal?: boolean }).IsInternal,
  );
  return { ...complaint, comments, attachments: recordsets[2] ?? [] };
};

/**
 * @openapi
 * /complaints:
 *   get:
 *     tags: [Complaints]
 *     summary: List complaints (residents see their own; anonymous ones stay anonymous)
 *     responses:
 *       200: { description: Paginated complaints }
 *   post:
 *     tags: [Complaints]
 *     summary: Submit a complaint (optionally anonymous)
 *     responses:
 *       201: { description: Complaint submitted }
 */
complaintsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      status: Joi.string().valid('Open', 'InReview', 'Resolved', 'Dismissed', 'Escalated'),
      category: Joi.string().max(20),
      search: Joi.string().max(200),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const isManager = isAdmin(req) || req.user!.roles.includes('BuildingOwner');
    const { recordset } = await execProc('sp_Complaint_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      SubmittedByUserId: isManager ? null : req.user!.userId,
      Status: req.query.status ?? null,
      Category: req.query.category ?? null,
      Search: req.query.search ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

complaintsRoutes.post(
  '/',
  validate({
    body: Joi.object({
      buildingId: id.required(),
      apartmentId: id.allow(null),
      isAnonymous: Joi.boolean().default(false),
      category: Joi.string()
        .valid('Noise', 'Cleanliness', 'Security', 'Neighbor', 'Staff', 'Facility', 'Parking', 'Other')
        .required(),
      subject: Joi.string().min(3).max(200).required(),
      description: Joi.string().max(2000),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Complaint_Create', {
      BuildingId: req.body.buildingId,
      ApartmentId: req.body.apartmentId ?? null,
      SubmittedByUserId: req.user!.userId,
      IsAnonymous: req.body.isAnonymous,
      Category: req.body.category,
      Subject: req.body.subject,
      Description: req.body.description ?? null,
    });
    res.status(201).json({ success: true, data: shapeComplaint(recordsets, false) });
  }),
);

complaintsRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const isManager = isAdmin(req) || req.user!.roles.includes('BuildingOwner');
    const { recordsets } = await execProc('sp_Complaint_GetById', {
      ComplaintId: Number(req.params.id),
    });
    const complaint = shapeComplaint(recordsets, isManager) as unknown as {
      SubmittedByUserId: number | null;
    };
    if (!isManager && complaint.SubmittedByUserId !== req.user!.userId) {
      throw ApiError.forbidden();
    }
    res.json({ success: true, data: complaint });
  }),
);

complaintsRoutes.patch(
  '/:id/status',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('InReview', 'Resolved', 'Dismissed', 'Escalated').required(),
      resolution: Joi.string().max(2000),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Complaint_UpdateStatus', {
      ComplaintId: Number(req.params.id),
      Status: req.body.status,
      Resolution: req.body.resolution ?? null,
      ResolvedByUserId: req.user!.userId,
    });
    const complaint = shapeComplaint(recordsets, true) as unknown as {
      ComplaintId: number;
      SubmittedByUserId: number | null;
      Subject: string;
    };
    if (complaint.SubmittedByUserId && ['Resolved', 'Dismissed'].includes(req.body.status)) {
      await notifyUser({
        userId: complaint.SubmittedByUserId,
        title: 'تحديث على شكواك | Complaint update',
        body: `${complaint.Subject} — ${req.body.status}`,
        type: 'Complaint',
        entityType: 'Complaint',
        entityId: complaint.ComplaintId,
      });
    }
    res.json({ success: true, data: complaint });
  }),
);

complaintsRoutes.post(
  '/:id/comments',
  validate({
    params: idParam,
    body: Joi.object({
      comment: Joi.string().min(1).max(1000).required(),
      isInternal: Joi.boolean().default(false),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const isManager = isAdmin(req) || req.user!.roles.includes('BuildingOwner');
    const { recordset } = await execProc('sp_Complaint_AddComment', {
      ComplaintId: Number(req.params.id),
      UserId: req.user!.userId,
      Comment: req.body.comment,
      IsInternal: isManager ? req.body.isInternal : false,
    });
    res.status(201).json({ success: true, data: recordset[0] });
  }),
);

complaintsRoutes.post(
  '/:id/attachments',
  validate({
    params: idParam,
    body: Joi.object({
      fileUrl: Joi.string().uri().max(500).required(),
      fileType: Joi.string().valid('image', 'video', 'pdf', 'other').default('image'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Complaint_AddAttachment', {
      ComplaintId: Number(req.params.id),
      FileUrl: req.body.fileUrl,
      FileType: req.body.fileType,
    });
    res.status(201).json({ success: true, data: recordset[0] });
  }),
);
