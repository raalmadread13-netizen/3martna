import { execProc } from '../config/db';
import { getMessaging } from '../config/firebase';
import { logger } from '../config/logger';

export interface NotifyOptions {
  userId: number;
  title: string;
  body?: string;
  type?:
    | 'Payment'
    | 'Maintenance'
    | 'Complaint'
    | 'Visitor'
    | 'Announcement'
    | 'Chat'
    | 'Security'
    | 'Contract'
    | 'System';
  entityType?: string;
  entityId?: number;
}

/**
 * Persist an in-app notification and push it to the user's devices
 * through FCM. Failures are logged, never thrown — notifying must not
 * break the triggering business operation.
 */
export const notifyUser = async (options: NotifyOptions): Promise<void> => {
  const { userId, title, body, type = 'System', entityType, entityId } = options;
  try {
    await execProc('sp_Notification_Create', {
      UserId: userId,
      Title: title,
      Body: body ?? null,
      NotifType: type,
      EntityType: entityType ?? null,
      EntityId: entityId ?? null,
    });

    const messaging = getMessaging();
    if (!messaging) return;

    const { recordset } = await execProc<{ FcmToken: string }>('sp_UserDevice_GetTokens', {
      UserId: userId,
    });
    const tokens = recordset.map((row) => row.FcmToken).filter(Boolean);
    if (tokens.length === 0) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: body ?? undefined },
      data: {
        type,
        entityType: entityType ?? '',
        entityId: entityId ? String(entityId) : '',
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (error) {
    logger.warn('notifyUser failed', { userId, error: (error as Error).message });
  }
};

export const notifyMany = async (
  userIds: number[],
  options: Omit<NotifyOptions, 'userId'>,
): Promise<void> => {
  await Promise.all(userIds.map((userId) => notifyUser({ ...options, userId })));
};
