import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { env, isFirebaseConfigured } from '@/shared/config/env';

/**
 * Firebase JS SDK — prepared for later sprints:
 *   firebase/auth      → phone OTP authentication
 *   firebase/storage   → image & document uploads
 *   firebase/database  → realtime alerts & chat
 * Push notifications are handled by expo-notifications
 * (see infrastructure/notifications/push.ts).
 *
 * Returns null when the public config is absent so the app runs
 * cleanly in local development without a Firebase project.
 */
let app: FirebaseApp | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(env.firebase);
  }
  return app;
};
