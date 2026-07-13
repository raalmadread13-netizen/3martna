import admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

let app: admin.app.App | null = null;

/**
 * Firebase Admin is optional in local development (no service account),
 * and required in production for push notifications, OTP verification
 * and storage-signed URLs.
 */
export const getFirebase = (): admin.app.App | null => {
  if (app) return app;
  if (!env.firebase.serviceAccount) {
    if (env.isProduction) logger.warn('FIREBASE_SERVICE_ACCOUNT is not set — Firebase features disabled');
    return null;
  }
  try {
    const credentials = JSON.parse(env.firebase.serviceAccount);
    app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
      storageBucket: env.firebase.storageBucket || undefined,
    });
    logger.info('Firebase Admin initialised');
    return app;
  } catch (error) {
    logger.error('Failed to initialise Firebase Admin', { error: (error as Error).message });
    return null;
  }
};

export const getMessaging = (): admin.messaging.Messaging | null => {
  const firebase = getFirebase();
  return firebase ? firebase.messaging() : null;
};

export const verifyFirebaseIdToken = async (
  idToken: string,
): Promise<admin.auth.DecodedIdToken | null> => {
  const firebase = getFirebase();
  if (!firebase) return null;
  return firebase.auth().verifyIdToken(idToken);
};
