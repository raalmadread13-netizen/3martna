import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyUser } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const maintenanceRoutes = Router();
maintenanceRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });
const managers = authorize('BuildingOwner');

interface MaintenanceRow {
  RequestId: number;
  RequestedByUserId: number;
  AssignedToUserId: number | null;
  Title: string;
  Status: string;
}

const shapeRequest = (recordsets: Record<string, unknown>[][]) => {
  const request = recordsets[0]?.[0];
  if (!request) throw ApiError.notFound('Maintenance request not found');
  return { ...request, attachments: recordsets[1] ?? [], comments: recordsets[2] ?? [] };
};

const canView = (req: Request, row: MaintenanceRow): boolean =>
  isAdmin(req) ||
  req.user!.roles.includes('BuildingOwner') ||
  row.RequestedByUserId === req.user!.userId ||
  row.AssignedToUserId === req.user!.userId;

/**
 * @openapi
 * /maintenance:
 *   get:
 *     tags: [Maintenance]
 *     summary: List maintenance requests (role-scoped)
 *     responses:
 *       200: { description: Paginated requests ordered by priority }
 *   post:
 *     tags: [Maintenance]
 *     summary: Create a maintenance request
 *     responses:
 *       201: { description: Request created }
 */
maintenanceRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      status: Joi.string().valid('Open', 'Assigned', 'InProgress', 'OnHold', 'Completed', 'Cancelled', 'Rejected'),
      priority: Joi.string().valid('Low', 'Medium', 'High', 'Emergency'),
      category: Joi.string().max(20),
      search: Joi.string().max(200),
      mine: Joi.boolean().default(false),      // requester view
      assigned: Joi.boolean().default(false),  // technician view
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const roles = req.user!.roles;
    const isManager = isAdmin(req) || roles.includes('BuildingOwner');
    const technician = roles.includes('MaintenanceEmployee') || roles.includes('CleaningStaff');

    // Joi has coerced these to booleans; Express types still say string
    const mine = req.query.mine as unknown as boolean;
    const assigned = req.query.assigned as unknown as boolean;

    // Non-managers are forced into their own scope
    const requestedBy = mine || (!isManager && !technician) ? req.user!.userId : null;
    const assignedTo = assigned || (!isManager && technician) ? req.user!.userId : null;

    const { recordset } = await execProc('sp_Maintenance_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      RequestedByUserId: requestedBy,
      AssignedToUserId: assignedTo,
      Status: req.query.status ?? null,
      Priority: req.query.priority ?? null,
      Category: req.query.category ?? null,
      Search: req.query.search ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

maintenanceRoutes.post(
  '/',
  validate({
    body: Joi.object({
      buildingId: id.required(),
      apartmentId: id.allow(null),
      title: Joi.string().min(3).max(200).required(),
      description: Joi.string().max(2000),
      category: Joi.string()
        .valid('Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting', 'Cleaning', 'Elevator', 'Appliance', 'Other')
        .required(),
      priority: Joi.string().valid('Low', 'Medium', 'High', 'Emergency').default('Medium'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Maintenance_Create', {
      BuildingId: req.body.buildingId,
      ApartmentId: req.body.apartmentId ?? null,
      RequestedByUserId: req.user!.userId,
      Title: req.body.title,
      Description: req.body.description ?? null,
      Category: req.body.category,
      Priority: req.body.priority,
    });
    res.status(201).json({ success: true, data: shapeRequest(recordsets) });
  }),
);

maintenanceRoutes.get(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Maintenance_GetById', {
      RequestId: Number(req.params.id),
    });
    const request = shapeRequest(recordsets);
    if (!canView(req, request as unknown as MaintenanceRow)) throw ApiError.forbidden();
    res.json({ success: true, data: request });
  }),
);

maintenanceRoutes.post(
  '/:id/assign',
  managers,
  validate({
    params: idParam,
    body: Joi.object({
      assignedToUserId: id.required(),
      scheduledAt: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Maintenance_Assign', {
      RequestId: Number(req.params.id),
      AssignedToUserId: req.body.assignedToUserId,
      AssignedByUserId: req.user!.userId,
      ScheduledAt: req.body.scheduledAt ?? null,
    });
    const request = shapeRequest(recordsets) as unknown as MaintenanceRow;
    await notifyUser({
      userId: req.body.assignedToUserId,
      title: 'مهمة صيانة جديدة | New maintenance task',
      body: request.Title,
      type: 'Maintenance',
      entityType: 'MaintenanceRequest',
      entityId: request.RequestId,
    });
    res.json({ success: true, data: request });
  }),
);

maintenanceRoutes.patch(
  '/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string()
        .valid('InProgress', 'OnHold', 'Completed', 'Cancelled', 'Rejected')
        .required(),
      completionNotes: Joi.string().max(2000),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    // Verify the caller is allowed to transition this request
    const { recordsets: current } = await execProc('sp_Maintenance_GetById', {
      RequestId: Number(req.params.id),
    });
    const existing = current[0]?.[0] as unknown as MaintenanceRow | undefined;
    if (!existing) throw ApiError.notFound('Maintenance request not found');

    const roles = req.user!.roles;
    const isManager = isAdmin(req) || roles.includes('BuildingOwner');
    const isAssignee = existing.AssignedToUserId === req.user!.userId;
    const isRequester = existing.RequestedByUserId === req.user!.userId;
    const cancelling = req.body.status === 'Cancelled';
    if (!(isManager || isAssignee || (isRequester && cancelling))) throw ApiError.forbidden();

    const { recordsets } = await execProc('sp_Maintenance_UpdateStatus', {
      RequestId: Number(req.params.id),
      Status: req.body.status,
      CompletionNotes: req.body.completionNotes ?? null,
    });
    const request = shapeRequest(recordsets) as unknown as MaintenanceRow;

    if (req.body.status === 'Completed') {
      await notifyUser({
        userId: request.RequestedByUserId,
        title: 'اكتملت الصيانة | Maintenance completed',
        body: request.Title,
        type: 'Maintenance',
        entityType: 'MaintenanceRequest',
        entityId: request.RequestId,
      });
    }
    res.json({ success: true, data: request });
  }),
);

/** Technician GPS check-in at the site. */
maintenanceRoutes.post(
  '/:id/check-in',
  authorize('MaintenanceEmployee', 'CleaningStaff'),
  validate({
    params: idParam,
    body: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Maintenance_CheckIn', {
      RequestId: Number(req.params.id),
      UserId: req.user!.userId,
      Latitude: req.body.latitude,
      Longitude: req.body.longitude,
    });
    res.json({ success: true, data: shapeRequest(recordsets) });
  }),
);

maintenanceRoutes.post(
  '/:id/check-out',
  authorize('MaintenanceEmployee', 'CleaningStaff'),
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Maintenance_CheckOut', {
      RequestId: Number(req.params.id),
      UserId: req.user!.userId,
    });
    res.json({ success: true, message: 'Checked out' });
  }),
);

/** Before/during/after photos & videos (Firebase Storage URLs). */
maintenanceRoutes.post(
  '/:id/attachments',
  validate({
    params: idParam,
    body: Joi.object({
      fileUrl: Joi.string().uri().max(500).required(),
      fileType: Joi.string().valid('image', 'video', 'pdf', 'other').default('image'),
      stage: Joi.string().valid('Before', 'During', 'After', 'Other').default('Before'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Maintenance_AddAttachment', {
      RequestId: Number(req.params.id),
      UploadedByUserId: req.user!.userId,
      FileUrl: req.body.fileUrl,
      FileType: req.body.fileType,
      Stage: req.body.stage,
    });
    res.status(201).json({ success: true, data: recordset[0] });
  }),
);

maintenanceRoutes.post(
  '/:id/comments',
  validate({
    params: idParam,
    body: Joi.object({ comment: Joi.string().min(1).max(1000).required() }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Maintenance_AddComment', {
      RequestId: Number(req.params.id),
      UserId: req.user!.userId,
      Comment: req.body.comment,
    });
    res.status(201).json({ success: true, data: recordset[0] });
  }),
);

/** Requester rates the completed work (1–5). */
maintenanceRoutes.post(
  '/:id/rate',
  validate({
    params: idParam,
    body: Joi.object({
      rating: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Maintenance_Rate', {
      RequestId: Number(req.params.id),
      UserId: req.user!.userId,
      Rating: req.body.rating,
      RatingComment: req.body.comment ?? null,
    });
    res.json({ success: true, message: 'Rating saved' });
  }),
);

/* ---- staff schedules ---- */
maintenanceRoutes.get(
  '/schedules/list',
  validate({
    query: Joi.object({
      userId: id,
      buildingId: id,
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const roles = req.user!.roles;
    const isManager = isAdmin(req) || roles.includes('BuildingOwner');
    const { recordset } = await execProc('sp_StaffSchedule_List', {
      UserId: isManager ? req.query.userId ?? null : req.user!.userId,
      BuildingId: req.query.buildingId ?? null,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
    });
    res.json({ success: true, data: recordset });
  }),
);

maintenanceRoutes.post(
  '/schedules',
  managers,
  validate({
    body: Joi.object({
      userId: id.required(),
      buildingId: id.required(),
      taskType: Joi.string().valid('Maintenance', 'Cleaning', 'Security', 'Inspection', 'Other').required(),
      title: Joi.string().max(200).required(),
      scheduledDate: Joi.date().iso().required(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/),
      endTime: Joi.string().pattern(/^\d{2}:\d{2}$/),
      notes: Joi.string().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_StaffSchedule_Create', {
      UserId: req.body.userId,
      BuildingId: req.body.buildingId,
      TaskType: req.body.taskType,
      Title: req.body.title,
      ScheduledDate: req.body.scheduledDate,
      StartTime: req.body.startTime ?? null,
      EndTime: req.body.endTime ?? null,
      Notes: req.body.notes ?? null,
    });
    await notifyUser({
      userId: req.body.userId,
      title: 'جدول مهام جديد | New scheduled task',
      body: req.body.title,
      type: 'Maintenance',
    });
    res.status(201).json({ success: true, data: recordset[0] });
  }),
);

maintenanceRoutes.patch(
  '/schedules/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('InProgress', 'Completed', 'Cancelled').required(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_StaffSchedule_UpdateStatus', {
      ScheduleId: Number(req.params.id),
      Status: req.body.status,
    });
    res.json({ success: true, message: 'Schedule updated' });
  }),
);
