import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { notifyMany } from '../../services/notify';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { assertBuildingAccess } from '../buildings/buildings.controller';

export const announcementsRoutes = Router();
announcementsRoutes.use(authenticate);

/**
 * @openapi
 * /announcements:
 *   get:
 *     tags: [Announcements]
 *     summary: List announcements (pinned first)
 *     responses:
 *       200: { description: Paginated announcements }
 *   post:
 *     tags: [Announcements]
 *     summary: Publish an announcement (notifies residents)
 *     responses:
 *       201: { description: Announcement published }
 */
announcementsRoutes.get(
  '/',
  validate({
    query: Joi.object({ ...pageQuery, buildingId: id, includeExpired: Joi.boolean().default(false) }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Announcement_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      IncludeExpired: req.query.includeExpired ?? false,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

announcementsRoutes.post(
  '/',
  authorize('BuildingOwner'),
  validate({
    body: Joi.object({
      buildingId: id.allow(null),
      title: Joi.string().min(3).max(200).required(),
      body: Joi.string().min(3).max(4000).required(),
      audience: Joi.string().valid('All', 'Tenants', 'Owners', 'Staff').default('All'),
      isPinned: Joi.boolean().default(false),
      expiresAt: Joi.date().iso(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    if (req.body.buildingId) await assertBuildingAccess(req.body.buildingId, req);
    const announcement = await execProcOne<{ AnnouncementId: number }>('sp_Announcement_Create', {
      BuildingId: req.body.buildingId ?? null,
      CreatedByUserId: req.user!.userId,
      Title: req.body.title,
      Body: req.body.body,
      Audience: req.body.audience,
      IsPinned: req.body.isPinned,
      ExpiresAt: req.body.expiresAt ?? null,
    });

    // Push to residents of the target building
    if (req.body.buildingId && announcement) {
      const { recordset } = await execProc<{ UserId: number }>('sp_Resident_List', {
        Page: 1,
        PageSize: 100,
        BuildingId: req.body.buildingId,
      });
      await notifyMany([...new Set(recordset.map((row) => row.UserId))], {
        title: `📢 ${req.body.title}`,
        body: String(req.body.body).slice(0, 200),
        type: 'Announcement',
        entityType: 'Announcement',
        entityId: announcement.AnnouncementId,
      });
    }
    res.status(201).json({ success: true, data: announcement });
  }),
);

announcementsRoutes.delete(
  '/:id',
  authorize('BuildingOwner'),
  validate({ params: Joi.object({ id: id.required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Announcement_Delete', { AnnouncementId: Number(req.params.id) });
    res.json({ success: true, message: 'Announcement removed' });
  }),
);
