import 'dotenv/config';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {database, closeDatabase, transaction} from '../../server/db/connection';

const sha = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const shaFile = (filePath: string) => new Promise<string>((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});
const command = process.argv[2] || 'plan';
const environment = process.env.DATABASE_ENV;
const folder = 'supabase/adopted/migrations';

async function readMigrations() {
  const files = (await fs.readdir(folder)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  return Promise.all(files.map(async name => {
    const sql = await fs.readFile(path.join(folder, name), 'utf8');
    if (!sql.trim()) throw new Error(`Empty migration: ${name}`);
    const version = name.split('_')[0];
    return {name, version, sha256: sha(sql), sql};
  }));
}

async function buildPlan(client: {query: (sql: string, params?: any[]) => Promise<any>}, migrations: Awaited<ReturnType<typeof readMigrations>>) {
  const isAdopted = (await client.query("select to_regclass('public.user_profiles') as up, to_regclass('public.catalog_families') as cf")).rows[0];
  if (!isAdopted.up || !isAdopted.cf) throw new Error('Target database does not have adopted user_profiles/catalog_families. Expected adopted 49-table master schema.');
  const logExists = (await client.query("select to_regclass('app_private.schema_change_log') as name")).rows[0].name;
  const applied = logExists ? (await client.query('select version from app_private.schema_change_log')).rows as Array<{version: string}> : [];
  const appliedVersions = new Set(applied.map(r => r.version));
  const pending = migrations.filter(m => !appliedVersions.has(m.version));
  const identity = (await client.query('select current_database() as database, inet_server_addr()::text as host')).rows[0];
  const plan = {target: identity, environment, appliedCount: applied.length, pendingCount: pending.length, pending: pending.map(({sql, ...m}) => m)};
  return {plan, planSha256: sha(JSON.stringify(plan)), pending};
}

async function verifyProductionGates(planSha256: string) {
  if (process.env.PRODUCTION_MIGRATION_APPROVED !== 'yes') throw new Error('Production migration requires explicit owner approval: PRODUCTION_MIGRATION_APPROVED=yes');
  const reviewedPlan = process.env.REVIEWED_PLAN_SHA256?.trim().toLowerCase();
  if (!reviewedPlan || !/^[a-f0-9]{64}$/.test(reviewedPlan)) throw new Error('Production migration requires REVIEWED_PLAN_SHA256 from a reviewed db:plan:adopted output.');
  if (reviewedPlan !== planSha256) throw new Error('Reviewed migration plan SHA-256 does not match the current target/pending migration plan. Re-run db:plan:adopted and review it before approval.');
  const backupPath = process.env.VERIFIED_BACKUP_PATH?.trim();
  const expectedBackupSha = process.env.VERIFIED_BACKUP_SHA256?.trim().toLowerCase();
  if (!backupPath || !path.isAbsolute(backupPath)) throw new Error('Production migration requires VERIFIED_BACKUP_PATH as an absolute path to the verified database backup.');
  if (!expectedBackupSha || !/^[a-f0-9]{64}$/.test(expectedBackupSha)) throw new Error('Production migration requires VERIFIED_BACKUP_SHA256 with the reviewed backup SHA-256.');
  const stat = await fs.stat(backupPath);
  if (!stat.isFile() || stat.size === 0) throw new Error('Verified backup path is not a non-empty regular file.');
  const actualBackupSha = await shaFile(backupPath);
  if (actualBackupSha !== expectedBackupSha) throw new Error('Verified backup SHA-256 mismatch; refusing production migration.');
}

try {
  if (!['development', 'test', 'production'].includes(environment || '')) throw new Error('DATABASE_ENV must be explicitly set to development, test, or production.');
  if (!['plan', 'apply'].includes(command)) throw new Error('Usage: npm run db:plan:adopted | npm run db:migrate:adopted');
  const db = database();
  try {
    const migrations = await readMigrations();
    const initial = await buildPlan(db, migrations);
    console.log(JSON.stringify({...initial.plan, planSha256: initial.planSha256}, null, 2));
    if (command === 'plan') {
      process.exitCode = 0;
    } else if (initial.pending.length === 0) {
      console.log('All adopted migrations are already applied.');
    } else {
      if (environment === 'production') await verifyProductionGates(initial.planSha256);
      await transaction(async client => {
        await client.query("select pg_advisory_xact_lock(hashtextextended('sanatpish:adopted_migration', 0))");
        const lockedPlan = await buildPlan(client, migrations);
        if (lockedPlan.planSha256 !== initial.planSha256) throw new Error('Migration plan changed after acquiring the database lock. Re-run db:plan:adopted and review the new plan.');
        if (environment === 'production') await verifyProductionGates(lockedPlan.planSha256);
        await client.query('create schema if not exists app_private');
        await client.query(`create table if not exists app_private.schema_change_log(version text primary key, description text not null, applied_at timestamptz not null default now())`);
        for (const migration of lockedPlan.pending) {
          console.log(`Applying adopted migration: ${migration.name}...`);
          await client.query(migration.sql);
          await client.query('insert into app_private.schema_change_log(version, description) values($1, $2) on conflict(version) do nothing',[migration.version, migration.name]);
        }
      });
      console.log(`Successfully applied ${initial.pending.length} adopted migration(s).`);
    }
  } finally { await closeDatabase(); }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
