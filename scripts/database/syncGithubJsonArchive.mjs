#!/usr/bin/env node
/**
 * Verify (default) or append the versioned Git-tracked JSON snapshots in the
 * private Supabase archive. This is a maintenance tool, never a runtime source
 * of products, prices, inventory, images or authorization.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/database/syncGithubJsonArchive.mjs --verify
 *   DATABASE_URL=... EXPECTED_SUPABASE_PROJECT_REF=spkszfbeeufdcpcltqal \
 *     node scripts/database/syncGithubJsonArchive.mjs --sync
 *
 * Never run --sync from pull_request jobs with production database credentials.
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

const mode = process.argv.includes('--sync') ? 'sync' : 'verify';
if (process.argv.includes('--sync') && process.argv.includes('--verify'))
  throw new Error('Choose --verify or --sync');
const repo = 'javanwebi/script';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required. Never hardcode database credentials.');
if (mode === 'sync') {
  const expected = process.env.EXPECTED_SUPABASE_PROJECT_REF;
  if (!expected || !/^[a-z0-9]{20}$/.test(expected))
    throw new Error('EXPECTED_SUPABASE_PROJECT_REF is required for --sync.');
  const parsed = new URL(url);
  if (!(parsed.hostname + ':' + decodeURIComponent(parsed.username)).includes(expected))
    throw new Error('Refusing to write: DATABASE_URL does not identify the approved Supabase project.');
}

const paths = execFileSync('git', ['ls-files', '-z'], {encoding: 'utf8'})
  .split('\0').filter(path => path.endsWith('.json')).sort();
const pool = new pg.Pool({
  connectionString: url,
  max: 2,
  connectionTimeoutMillis: 10000,
  ...(process.env.DATABASE_SSL === 'require' ? {ssl: {rejectUnauthorized: true}} : {}),
});
const problems = [];
let verified = 0, added = 0;
try {
  // Ensure this is a catalog database, not an empty/misconfigured target.
  const ready = await pool.query("select to_regclass('app_private.source_archives') as archive, to_regclass('public.catalog_families') as families");
  if (!ready.rows[0].archive || !ready.rows[0].families)
    throw new Error('Missing expected Supabase catalog tables.');

  const archive = await pool.query(
    'select source_path,sha256 from app_private.source_archives where source_path like $1 and source_path not like $2',
    ['github/' + repo + '/%', '%/chunk/%']
  );
  const existing = new Set(archive.rows.map(row => row.source_path + ':' + row.sha256));
  for (const path of paths) {
    const raw = await readFile(path, 'utf8');
    JSON.parse(raw); // Fail on invalid source data; do not silently drop anything.
    const sha = createHash('sha256').update(raw, 'utf8').digest('hex');
    const sourcePath = 'github/' + repo + '/' + path;
    const identity = sourcePath + ':' + sha;
    if (existing.has(identity)) { verified++; continue; }
    if (mode === 'verify') {
      problems.push(path + ' (archive SHA-256 missing)');
      continue;
    }
    await pool.query(
      `insert into app_private.source_archives(source_path,sha256,payload)
       values ($1,$2,$3::jsonb) on conflict(source_path,sha256) do nothing`,
      [sourcePath,sha,raw]
    );
    added++;
  }
  const extraPaths = new Set(archive.rows.map(row => row.source_path)
    .filter(path => !paths.includes(path.slice(('github/' + repo + '/').length))));
  if (extraPaths.size) console.log('Historical archive paths retained:', extraPaths.size);
  console.log('Git-tracked JSON:', paths.length, 'already archived:', verified, 'new archived versions:', added);
  if (problems.length) {
    console.error('JSON archive parity failed for:', problems.join(', '));
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
