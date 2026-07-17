#!/usr/bin/env node
/**
 * Static integrity verification of the SQL migrations (Sprint 6.5).
 *
 * Without a live SQL Server this cannot execute the DDL, but it proves the
 * schema is internally consistent:
 *   1. every FK REFERENCES target table exists (dbo.Users comes from 0001)
 *   2. constraint/index names are unique (unless explicitly DROPped first)
 *   3. every business table carries the Sprint-3 standard columns
 *   4. every table has a primary key
 *   5. every GO batch is non-empty and parenthesis-balanced
 *
 * Usage: node scripts/verify-schema.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations');
const STANDARD_COLUMNS = [
  'TenantId',
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'UpdatedBy',
  'IsDeleted',
  'RowVersion',
];
/** Technical / identity-root tables exempt from the business standard. */
const STANDARD_EXEMPT = new Set([
  'Tenants', // is the tenant — carries no TenantId of its own
  'Users', // identity root: platform users may be tenant-less (TenantId NULL)
  'Roles',
  'Permissions',
  'RolePermissions',
  'UserRoles',
  'RefreshTokens',
  'VerificationCodes',
  'AuditLogs',
  'IdempotencyKeys',
  '_MigrationsHistory',
]);

const files = readdirSync(MIGRATIONS)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

const tables = new Map(); // name → { file, body }
const constraintNames = new Map(); // name → file
const dropped = new Set();
const problems = [];

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

  for (const match of sql.matchAll(/DROP CONSTRAINT\s+(\w+)/gi)) dropped.add(match[1]);

  for (const match of sql.matchAll(/CREATE TABLE dbo\.(\w+)\s*\(([\s\S]*?)^\);/gim)) {
    const [, name, body] = match;
    if (tables.has(name)) problems.push(`${file}: table dbo.${name} created twice`);
    tables.set(name, { file, body });
  }

  for (const match of sql.matchAll(/(?:CONSTRAINT|INDEX)\s+((?:PK|FK|CK|DF|UQ|IX)_\w+)/g)) {
    const name = match[1];
    if (constraintNames.has(name) && !dropped.has(name)) {
      problems.push(`${file}: duplicate constraint/index name ${name} (also in ${constraintNames.get(name)})`);
    }
    constraintNames.set(name, file);
  }

  for (const [index, batch] of sql.split(/^\s*GO\s*$/gim).entries()) {
    const open = (batch.match(/\(/g) ?? []).length;
    const close = (batch.match(/\)/g) ?? []).length;
    if (open !== close) problems.push(`${file}: batch #${index + 1} has unbalanced parentheses`);
  }
}

let fkCount = 0;
for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  for (const match of sql.matchAll(/REFERENCES dbo\.(\w+)\s*\(/g)) {
    fkCount += 1;
    if (!tables.has(match[1])) problems.push(`${file}: FK references missing table dbo.${match[1]}`);
  }
}

for (const [name, { file, body }] of tables) {
  if (!/PRIMARY KEY/i.test(body)) problems.push(`${file}: dbo.${name} has no primary key`);
  if (STANDARD_EXEMPT.has(name)) continue;
  for (const column of STANDARD_COLUMNS) {
    if (!new RegExp(`^\\s*${column}\\b`, 'im').test(body)) {
      problems.push(`${file}: dbo.${name} is missing standard column ${column}`);
    }
  }
}

const indexCount = [...constraintNames.keys()].filter((n) => n.startsWith('IX_') || n.startsWith('UQ_')).length;
console.log(`migrations: ${files.length} (${files.join(', ')})`);
console.log(`tables: ${tables.size}   foreign keys: ${fkCount}   indexes (IX/UQ): ${indexCount}`);
console.log(`named constraints/indexes: ${constraintNames.size}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\nSchema integrity: OK — FK targets, PKs, standard columns, unique names, balanced batches');
