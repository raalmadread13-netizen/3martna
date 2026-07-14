/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { closePool, getPool } from './connection';

/**
 * Seed runner — executes every `database/seeds/NNNN_*.sql` file in order.
 * Seed scripts must be idempotent (guard with IF NOT EXISTS).
 * Usage: `npm run db:seed`.
 */
const SEEDS_DIR = path.resolve(__dirname, '../../../../database/seeds');

const run = async (): Promise<void> => {
  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  if (files.length === 0) {
    console.log('No seed files found — nothing to do.');
    return;
  }

  const pool = await getPool();
  for (const file of files) {
    const script = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
    try {
      for (const batch of script.split(/^\s*GO\s*$/gim)) {
        if (batch.trim()) await pool.request().batch(batch);
      }
      console.log(`✓ ${file}`);
    } catch (error) {
      console.error(`✗ ${file} failed:`, (error as Error).message);
      process.exitCode = 1;
      break;
    }
  }
};

run()
  .catch((error) => {
    console.error('Seed run failed:', (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
