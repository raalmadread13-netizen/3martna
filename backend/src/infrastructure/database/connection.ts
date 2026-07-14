import sql from 'mssql';
import { env } from '@shared/config/env';
import { logger } from '@infrastructure/logging/logger';

/**
 * SQL Server connection layer.
 *
 * A lazily-created singleton pool. The API boots without a database when
 * DB_HOST is empty (early sprints / CI) — anything that actually needs the
 * pool then fails loudly with a clear message.
 */
const config: sql.config = {
  server: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  pool: { max: env.db.poolMax, min: 0, idleTimeoutMillis: 30_000 },
  options: {
    encrypt: env.db.encrypt,
    trustServerCertificate: env.db.trustServerCertificate,
    enableArithAbort: true,
  },
  requestTimeout: 30_000,
  connectionTimeout: 15_000,
};

let pool: sql.ConnectionPool | null = null;

export const isDatabaseConfigured = (): boolean => env.db.host.length > 0;

export const isDatabaseConnected = (): boolean => pool?.connected ?? false;

export const getPool = async (): Promise<sql.ConnectionPool> => {
  if (!isDatabaseConfigured()) {
    throw new Error('Database is not configured (DB_HOST is empty)');
  }
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', (err: Error) => logger.error('SQL pool error', { error: err.message }));
  logger.info(`Connected to SQL Server ${env.db.host}:${env.db.port}/${env.db.name}`);
  return pool;
};

/**
 * Execute a stored procedure with named, typed-bound parameters.
 * Parameter binding by the driver is the primary SQL-injection defence —
 * no string concatenation ever reaches the server.
 */
export const execProc = async <T = Record<string, unknown>>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<{ recordset: T[]; recordsets: T[][] }> => {
  const connection = await getPool();
  const request = connection.request();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) request.input(key, value);
  }
  const result = await request.execute(name);
  return {
    recordset: (result.recordset ?? []) as T[],
    recordsets: (result.recordsets ?? []) as unknown as T[][],
  };
};

/** Parameterized ad-hoc query — used by the migration runner only. */
export const execQuery = async <T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> => {
  const connection = await getPool();
  const request = connection.request();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) request.input(key, value);
  }
  const result = await request.query(query);
  return (result.recordset ?? []) as T[];
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};
