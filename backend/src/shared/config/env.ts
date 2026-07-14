import dotenv from 'dotenv';

dotenv.config();

/**
 * Typed, validated environment configuration.
 * Secrets have NO baked-in defaults in production — the process refuses
 * to boot rather than run with a guessable key.
 */
const requiredInProduction = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return `dev-only-${name.toLowerCase()}`;
  }
  return value;
};

const toNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: toNumber('PORT', 4000),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  db: {
    /** Empty host = run without a database (early sprints, CI). */
    host: process.env.DB_HOST ?? '',
    port: toNumber('DB_PORT', 1433),
    name: process.env.DB_NAME ?? 'Amartna',
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    poolMax: toNumber('DB_POOL_MAX', 10),
  },

  jwt: {
    accessSecret: requiredInProduction('JWT_ACCESS_SECRET'),
    refreshSecret: requiredInProduction('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresDays: toNumber('JWT_REFRESH_EXPIRES_DAYS', 30),
  },

  rateLimit: {
    windowMinutes: toNumber('RATE_LIMIT_WINDOW_MINUTES', 15),
    max: toNumber('RATE_LIMIT_MAX', 300),
    authMax: toNumber('AUTH_RATE_LIMIT_MAX', 10),
  },

  auth: {
    /** Failed logins before the account is temporarily locked. */
    maxFailedLogins: toNumber('AUTH_MAX_FAILED_LOGINS', 5),
    /** Lockout duration once the threshold is hit. */
    lockoutMinutes: toNumber('AUTH_LOCKOUT_MINUTES', 15),
    /** Lifetime of email/phone verification codes. */
    verificationCodeTtlMinutes: toNumber('AUTH_VERIFICATION_TTL_MINUTES', 10),
    /** Lifetime of password-reset tokens. */
    resetTokenTtlMinutes: toNumber('AUTH_RESET_TTL_MINUTES', 60),
  },

  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ?? '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
    databaseUrl: process.env.FIREBASE_DATABASE_URL ?? '',
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;

export type Env = typeof env;
