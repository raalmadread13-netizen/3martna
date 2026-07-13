import dotenv from 'dotenv';

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    // Secrets must never have baked-in defaults in production.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return `dev-only-${name.toLowerCase()}`;
  }
  return value;
};

const num = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: num('PORT', 4000),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: num('DB_PORT', 1433),
    name: process.env.DB_NAME ?? 'Amartna',
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    poolMax: num('DB_POOL_MAX', 10),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresDays: num('JWT_REFRESH_EXPIRES_DAYS', 30),
  },

  rateLimit: {
    windowMinutes: num('RATE_LIMIT_WINDOW_MINUTES', 15),
    max: num('RATE_LIMIT_MAX', 300),
    authMax: num('AUTH_RATE_LIMIT_MAX', 10),
  },

  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ?? '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  },

  enableJobs: process.env.ENABLE_JOBS !== 'false',
  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;
