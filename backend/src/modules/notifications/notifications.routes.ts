import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { pageQuery, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const notificationsRoutes = Router();
notificationsRoutes.use(authenticate);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: In-app notifications for the current user (with unread count)
 *     responses:
 *       200: { description: Paginated notifications }
 */
notificationsRoutes.get(
  '/',
  validate({ query: Joi.object({ ...pageQuery, unreadOnly: Joi.boolean().default(false) }) }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc<{ UnreadCount?: number; TotalCount?: number }>(
      'sp_Notification_List',
      {
        UserId: req.user!.userId,
        Page: pagination.page,
        PageSize: pagination.pageSize,
        UnreadOnly: req.query.unreadOnly ?? false,
      },
    );
    const unreadCount = recordset[0]?.UnreadCount ?? 0;
    const result = paginate(recordset, pagination);
    // Strip the window-function helper column from each row
    result.data = result.data.map(({ UnreadCount: _u, ...rest }) => rest) as typeof result.data;
    res.json({ success: true, ...result, unreadCount });
  }),
);

notificationsRoutes.post(
  '/read-all',
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Notification_MarkRead', { UserId: req.user!.userId, NotificationId: null });
    res.json({ success: true, message: 'All notifications marked read' });
  }),
);

notificationsRoutes.post(
  '/:id/read',
  validate({ params: Joi.object({ id: Joi.number().integer().positive().required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Notification_MarkRead', {
      UserId: req.user!.userId,
      NotificationId: Number(req.params.id),
    });
    res.json({ success: true, message: 'Notification marked read' });
  }),
);
