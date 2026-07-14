import admin from 'firebase-admin';
import { env } from '@shared/config/env';
import { logger } from '@infrastructure/logging/logger';

/**
 * Firebase Admin SDK — prepared for later sprints:
 *   auth       → OTP / phone-verification checks
 *   storage    → signed URLs for documents & images
 *   messaging  → FCM push notifications
 *   database   → realtime alerts
 *
 * Disabled cleanly when FIREBASE_SERVICE_ACCOUNT is empty (local dev, CI).
 */
let app: admin.app.App | null = null;

export const getFirebase = (): admin.app.App | null => {
  if (app) return app;
  if (!env.firebase.serviceAccount) {
    if (env.isProduction) {
      logger.warn('FIREBASE_SERVICE_ACCOUNT not set — Firebase features disabled');
    }
    return null;
  }
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(env.firebase.serviceAccount)),
      storageBucket: env.firebase.storageBucket || undefined,
      databaseURL: env.firebase.databaseUrl || undefined,
    });
    logger.info('Firebase Admin initialised');
    return app;
  } catch (error) {
    logger.error('Firebase Admin initialisation failed', { error: (error as Error).message });
    return null;
  }
};

export const firebaseAuth = (): admin.auth.Auth | null => getFirebase()?.auth() ?? null;
export const firebaseMessaging = (): admin.messaging.Messaging | null =>
  getFirebase()?.messaging() ?? null;
export const firebaseStorage = (): admin.storage.Storage | null => getFirebase()?.storage() ?? null;
export const firebaseDatabase = (): admin.database.Database | null =>
  getFirebase()?.database() ?? null;
