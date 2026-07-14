/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { closePool, execQuery, getPool } from './connection';

/**
 * Forward-only SQL migration runner.
 *
 * Applies every `database/migrations/NNNN_*.sql` file that is not yet
 * recorded in dbo._MigrationsHistory, in filename order, each inside a
 * transaction. Usage: `npm run db:migrate`.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../database/migrations');

const ensureHistoryTable = async (): Promise<void> => {
  await execQuery(`
    IF OBJECT_ID('dbo._MigrationsHistory') IS NULL
    CREATE TABLE dbo._MigrationsHistory (
        MigrationId VARCHAR(255) NOT NULL PRIMARY KEY,
        AppliedAt   DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    );
  `);
};

const run = async (): Promise<void> => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found — nothing to do.');
    return;
  }

  await ensureHistoryTable();
  const applied = new Set(
    (
      await execQuery<{ MigrationId: string }>('SELECT MigrationId FROM dbo._MigrationsHistory')
    ).map((row) => row.MigrationId),
  );

  const pool = await getPool();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`= ${file} (already applied)`);
      continue;
    }
    const script = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const transaction = pool.transaction();
    await transaction.begin();
    try {
      // Split on GO batch separators (line-level, T-SQL convention)
      for (const batch of script.split(/^\s*GO\s*$/gim)) {
        if (batch.trim()) await transaction.request().batch(batch);
      }
      await transaction
        .request()
        .input('id', file)
        .query('INSERT INTO dbo._MigrationsHistory (MigrationId) VALUES (@id)');
      await transaction.commit();
      console.log(`✓ ${file}`);
    } catch (error) {
      await transaction.rollback();
      console.error(`✗ ${file} failed:`, (error as Error).message);
      process.exitCode = 1;
      break;
    }
  }
};

run()
  .catch((error) => {
    console.error('Migration run failed:', (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
