import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { v4 as uuid } from 'uuid';
import { execProc } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { id, validate } from '../../middleware/validate';
import { notifyMany } from '../../services/notify';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

export const chatRoutes = Router();
chatRoutes.use(authenticate);

/**
 * Messages flow through Firebase Firestore in realtime (typing indicators,
 * read receipts, attachments). This API owns thread membership so access
 * rules live in one place; the mobile client subscribes to
 * `threads/{firebaseKey}/messages` after fetching its thread list here.
 *
 * @openapi
 * /chat/threads:
 *   get:
 *     tags: [Chat]
 *     summary: List the current user's chat threads
 *     responses:
 *       200: { description: Threads with Firebase keys }
 *   post:
 *     tags: [Chat]
 *     summary: Create a private or group thread
 *     responses:
 *       201: { description: Thread created }
 */
chatRoutes.get(
  '/threads',
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_ChatThread_ListForUser', {
      UserId: req.user!.userId,
    });
    res.json({ success: true, data: recordset });
  }),
);

chatRoutes.post(
  '/threads',
  validate({
    body: Joi.object({
      threadType: Joi.string().valid('Private', 'Group').required(),
      title: Joi.string().max(150).when('threadType', {
        is: 'Group',
        then: Joi.required(),
      }),
      buildingId: id.allow(null),
      memberIds: Joi.array().items(id).min(1).max(100).required(),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const memberIds: number[] = [...new Set([...req.body.memberIds, req.user!.userId])];
    if (req.body.threadType === 'Private' && memberIds.length !== 2) {
      throw ApiError.badRequest('Private threads must have exactly two members');
    }
    const firebaseKey = `thread_${uuid()}`;
    const { recordsets } = await execProc('sp_ChatThread_Create', {
      FirebaseKey: firebaseKey,
      ThreadType: req.body.threadType,
      Title: req.body.title ?? null,
      BuildingId: req.body.buildingId ?? null,
      CreatedByUserId: req.user!.userId,
      MemberIds: JSON.stringify(memberIds),
    });
    const thread = recordsets[0]?.[0] as { ThreadId: number } | undefined;

    await notifyMany(
      memberIds.filter((memberId) => memberId !== req.user!.userId),
      {
        title: 'محادثة جديدة | New conversation',
        body: req.body.title ?? req.user!.fullName,
        type: 'Chat',
        entityType: 'ChatThread',
        entityId: thread?.ThreadId,
      },
    );
    res.status(201).json({ success: true, data: { ...thread, members: recordsets[1] ?? [] } });
  }),
);

chatRoutes.get(
  '/threads/:id',
  validate({ params: Joi.object({ id: id.required() }) }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_ChatThread_GetById', {
      ThreadId: Number(req.params.id),
    });
    const thread = recordsets[0]?.[0];
    if (!thread) throw ApiError.notFound('Thread not found');
    const members = (recordsets[1] ?? []) as Array<{ UserId: number }>;
    if (!members.some((member) => member.UserId === req.user!.userId)) {
      throw ApiError.forbidden('Not a member of this thread');
    }
    res.json({ success: true, data: { ...thread, members } });
  }),
);

/** Push-notify thread members about a new message (client calls after Firestore write). */
chatRoutes.post(
  '/threads/:id/notify',
  validate({
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ preview: Joi.string().max(200).allow('') }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_ChatThread_GetById', {
      ThreadId: Number(req.params.id),
    });
    const members = (recordsets[1] ?? []) as Array<{ UserId: number }>;
    if (!members.some((member) => member.UserId === req.user!.userId)) {
      throw ApiError.forbidden('Not a member of this thread');
    }
    await notifyMany(
      members.map((member) => member.UserId).filter((memberId) => memberId !== req.user!.userId),
      {
        title: req.user!.fullName,
        body: req.body.preview || 'New message',
        type: 'Chat',
        entityType: 'ChatThread',
        entityId: Number(req.params.id),
      },
    );
    res.json({ success: true, message: 'Members notified' });
  }),
);
