import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyMany } from '../../services/notify';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { assertBuildingAccess } from '../buildings/buildings.controller';

export const securityRoutes = Router();
securityRoutes.use(authenticate);

const securityStaff = authorize('SecurityGuard', 'BuildingOwner');

/* ---- gate logs ---- */

/**
 * @openapi
 * /security/gate-logs:
 *   get:
 *     tags: [Security]
 *     summary: Gate log for a building
 *     responses:
 *       200: { description: Paginated gate entries }
 *   post:
 *     tags: [Security]
 *     summary: Log a gate entry/exit (deliveries, contractors, etc.)
 *     responses:
 *       201: { description: Entry logged }
 */
securityRoutes.get(
  '/gate-logs',
  securityStaff,
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id.required(),
      fromDate: Joi.date().iso(),
      toDate: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_GateLog_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId,
      FromDate: req.query.fromDate ?? null,
      ToDate: req.query.toDate ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

securityRoutes.post(
  '/gate-logs',
  securityStaff,
  validate({
    body: Joi.object({
      buildingId: id.required(),
      entryType: Joi.string()
        .valid('VisitorIn', 'VisitorOut', 'DeliveryIn', 'DeliveryOut', 'ContractorIn', 'ContractorOut', 'Other')
        .required(),
      personName: Joi.string().max(150),
      notes: Joi.string().max(500),
      visitorId: id.allow(null),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const log = await execProcOne('sp_GateLog_Create', {
      BuildingId: req.body.buildingId,
      LoggedByUserId: req.user!.userId,
      EntryType: req.body.entryType,
      PersonName: req.body.personName ?? null,
      Notes: req.body.notes ?? null,
      VisitorId: req.body.visitorId ?? null,
    });
    res.status(201).json({ success: true, data: log });
  }),
);

/* ---- incident reports ---- */

securityRoutes.get(
  '/incidents',
  securityStaff,
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      status: Joi.string().valid('Open', 'UnderInvestigation', 'Resolved', 'Closed'),
      severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Incident_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      Status: req.query.status ?? null,
      Severity: req.query.severity ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

securityRoutes.post(
  '/incidents',
  securityStaff,
  validate({
    body: Joi.object({
      buildingId: id.required(),
      severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical').required(),
      title: Joi.string().min(3).max(200).required(),
      description: Joi.string().max(2000),
      location: Joi.string().max(200),
      occurredAt: Joi.date().iso().required(),
      attachmentUrl: Joi.string().uri().max(500),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const incident = await execProcOne('sp_Incident_Create', {
      BuildingId: req.body.buildingId,
      ReportedByUserId: req.user!.userId,
      Severity: req.body.severity,
      Title: req.body.title,
      Description: req.body.description ?? null,
      Location: req.body.location ?? null,
      OccurredAt: req.body.occurredAt,
      AttachmentUrl: req.body.attachmentUrl ?? null,
    });
    res.status(201).json({ success: true, data: incident });
  }),
);

securityRoutes.patch(
  '/incidents/:id/status',
  securityStaff,
  validate({
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      status: Joi.string().valid('UnderInvestigation', 'Resolved', 'Closed').required(),
      resolutionNotes: Joi.string().max(2000),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Incident_UpdateStatus', {
      IncidentId: Number(req.params.id),
      Status: req.body.status,
      ResolutionNotes: req.body.resolutionNotes ?? null,
    });
    res.json({ success: true, message: 'Incident updated' });
  }),
);

/* ---- emergency alert (broadcast to all building residents) ---- */

/**
 * @openapi
 * /security/emergency-alert:
 *   post:
 *     tags: [Security]
 *     summary: Broadcast an emergency alert to every resident of a building
 *     responses:
 *       200: { description: Alert dispatched }
 */
securityRoutes.post(
  '/emergency-alert',
  securityStaff,
  validate({
    body: Joi.object({
      buildingId: id.required(),
      title: Joi.string().min(3).max(200).required(),
      body: Joi.string().max(1000).required(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    await assertBuildingAccess(req.body.buildingId, req);
    const { recordset } = await execProc<{ UserId: number }>('sp_Resident_List', {
      Page: 1,
      PageSize: 100,
      BuildingId: req.body.buildingId,
    });
    const userIds = [...new Set(recordset.map((row) => row.UserId))];
    await notifyMany(userIds, {
      title: `🚨 ${req.body.title}`,
      body: req.body.body,
      type: 'Security',
    });
    res.json({ success: true, data: { notified: userIds.length } });
  }),
);
