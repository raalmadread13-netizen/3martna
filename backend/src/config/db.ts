import sql from 'mssql';
import { env } from './env';
import { logger } from './logger';

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

export const getPool = async (): Promise<sql.ConnectionPool> => {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', (err) => logger.error('SQL pool error', { error: err.message }));
  logger.info(`Connected to SQL Server: ${env.db.host}/${env.db.name}`);
  return pool;
};

export type ProcParams = Record<string, unknown>;

/**
 * Execute a stored procedure with named parameters.
 * All application data access flows through stored procedures — the
 * mssql driver binds every value as a typed parameter, which is the
 * primary SQL-injection defence.
 */
export const execProc = async <T = Record<string, unknown>>(
  name: string,
  params: ProcParams = {},
): Promise<{ recordset: T[]; recordsets: T[][] }> => {
  const connection = await getPool();
  const request = connection.request();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) request.input(key, value as sql.ISqlType | unknown);
  }
  const result = await request.execute(name);
  return {
    recordset: (result.recordset ?? []) as T[],
    recordsets: (result.recordsets ?? []) as unknown as T[][],
  };
};

/** First row of the first recordset, or null. */
export const execProcOne = async <T = Record<string, unknown>>(
  name: string,
  params: ProcParams = {},
): Promise<T | null> => {
  const { recordset } = await execProc<T>(name, params);
  return recordset[0] ?? null;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};
