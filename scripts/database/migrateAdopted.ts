import 'dotenv/config';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {database, closeDatabase, transaction} from '../../server/db/connection';

const sha = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const command = process.argv[2] || 'plan';

try {
  const db = database();
  const isAdopted = (await db.query("select to_regclass('public.user_profiles') as up, to_regclass('public.catalog_families') as cf")).rows[0];
  if (!isAdopted.up || !isAdopted.cf) {
    throw new Error('Target database does not have adopted user_profiles/catalog_families. Expected adopted 49-table master schema.');
  }

  const folder = 'supabase/adopted/migrations';
  const files = (await fs.readdir(folder)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  const migrations = await Promise.all(files.map(async name => {
    const sql = await fs.readFile(`${folder}/${name}`, 'utf8');
    if (!sql.trim()) throw new Error(`Empty migration: ${name}`);
    const version = name.split('_')[0];
    return {name, version, sha256: sha(sql), sql};
  }));

  const logExists = (await db.query("select to_regclass('app_private.schema_change_log') as name")).rows[0].name;
  const applied: {version: string}[] = logExists
    ? (await db.query('select version from app_private.schema_change_log')).rows
    : [];

  const appliedVersions = new Set(applied.map(r => r.version));
  const pending = migrations.filter(m => !appliedVersions.has(m.version));

  const identity = (await db.query('select current_database() as database, inet_server_addr()::text as host')).rows[0];
  const plan = {
    target: identity,
    environment: process.env.DATABASE_ENV || 'development',
    appliedCount: applied.length,
    pendingCount: pending.length,
    pending: pending.map(({sql, ...m}) => m)
  };

  const digest = sha(JSON.stringify(plan));
  console.log(JSON.stringify({...plan, planSha256: digest}, null, 2));

  if (command === 'plan') {
    process.exitCode = 0;
  } else if (command === 'apply') {
    if (process.env.DATABASE_ENV === 'production') {
      if (process.env.PRODUCTION_MIGRATION_APPROVED !== 'yes') {
        throw new Error('Production migration requires explicit owner approval: PRODUCTION_MIGRATION_APPROVED=yes');
      }
    }

    if (pending.length === 0) {
      console.log('All adopted migrations are already applied.');
    } else {
      await transaction(async client => {
        await client.query("select pg_advisory_xact_lock(hashtextextended('sanatpish:adopted_migration', 0))");
        await client.query('create schema if not exists app_private');
        await client.query(`
          create table if not exists app_private.schema_change_log (
            version text primary key,
            applied_at timestamptz not null default now(),
            description text
          )
        `);

        for (const migration of pending) {
          console.log(`Applying adopted migration: ${migration.name}...`);
          await client.query(migration.sql);
          await client.query(
            'insert into app_private.schema_change_log(version, description) values ($1, $2) on conflict (version) do nothing',
            [migration.version, `Adopted migration: ${migration.name}`]
          );
        }
      });
      console.log(`Successfully applied ${pending.length} adopted migration(s).`);
    }
  } else {
    throw new Error('Usage: npm run db:plan:adopted | npm run db:migrate:adopted');
  }
} finally {
  await closeDatabase();
}
