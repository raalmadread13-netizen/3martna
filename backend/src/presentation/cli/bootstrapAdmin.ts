/* eslint-disable no-console */
import readline from 'readline';
import { Writable } from 'stream';
import { BootstrapSuperAdmin } from '@application/use-cases/admin/BootstrapSuperAdmin';
import { closePool } from '@infrastructure/database/connection';
import { SqlAuditLogRepository } from '@infrastructure/database/repositories/SqlAuditLogRepository';
import { SqlRoleRepository } from '@infrastructure/database/repositories/SqlRoleRepository';
import { SqlUserRepository } from '@infrastructure/database/repositories/SqlUserRepository';
import { passwordHasher } from '@infrastructure/security/BcryptPasswordHasher';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';

/**
 * One-time SuperAdmin bootstrap (ADR-0005): `npm run bootstrap:admin`
 *
 * - Interactive: asks for name, email, phone and password (hidden input).
 * - Fails if a SuperAdmin already exists.
 * - Development-first: production runs require BOTH the
 *   ALLOW_PRODUCTION_BOOTSTRAP=true environment variable AND typing an
 *   explicit confirmation phrase.
 */

const ask = (rl: readline.Interface, query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, (answer) => resolve(answer.trim())));

/** Password prompt with muted echo. */
const askHidden = (query: string): Promise<string> => {
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(query);
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;

const confirmProductionOrExit = async (rl: readline.Interface): Promise<void> => {
  if (!env.isProduction) return;

  if (process.env.ALLOW_PRODUCTION_BOOTSTRAP !== 'true') {
    console.error(
      '✗ Refusing to bootstrap in production.\n' +
        '  Set ALLOW_PRODUCTION_BOOTSTRAP=true and re-run to proceed deliberately.',
    );
    process.exit(1);
  }

  const phrase = `BOOTSTRAP ${env.db.name.toUpperCase()}`;
  console.log(`⚠ PRODUCTION environment detected (database: ${env.db.name}).`);
  const typed = await ask(rl, `  Type "${phrase}" to confirm: `);
  if (typed !== phrase) {
    console.error('✗ Confirmation phrase did not match — aborting.');
    process.exit(1);
  }
};

const run = async (): Promise<void> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('── 3martna · SuperAdmin bootstrap ─────────────────');
  await confirmProductionOrExit(rl);

  const firstName = await ask(rl, 'First name: ');
  const lastName = await ask(rl, 'Last name: ');
  const email = await ask(rl, 'Email: ');
  const phoneNumber = await ask(rl, 'Phone number (+9627XXXXXXXX): ');
  rl.close();

  if (firstName.length < 2 || lastName.length < 2) {
    console.error('✗ First and last name must be at least 2 characters.');
    process.exit(1);
  }
  if (!EMAIL_PATTERN.test(email)) {
    console.error('✗ Invalid email address.');
    process.exit(1);
  }
  if (!PHONE_PATTERN.test(phoneNumber)) {
    console.error('✗ Invalid phone number (expected international format).');
    process.exit(1);
  }

  const password = await askHidden('Password (8+ chars, upper, lower, digit): ');
  const confirm = await askHidden('Confirm password: ');
  if (password !== confirm) {
    console.error('✗ Passwords do not match.');
    process.exit(1);
  }

  const bootstrap = new BootstrapSuperAdmin(
    new SqlUserRepository(),
    new SqlRoleRepository(),
    passwordHasher,
    new SqlAuditLogRepository(),
  );

  try {
    const result = await bootstrap.execute({ firstName, lastName, email, phoneNumber, password });
    console.log(`✅ SuperAdmin created: ${result.email} (id ${result.userId})`);
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`✗ ${error.message} [${error.code}]`);
      if (Array.isArray(error.details)) {
        for (const detail of error.details) console.error(`  - ${detail}`);
      }
    } else {
      console.error('✗ Bootstrap failed:', (error as Error).message);
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

void run();
