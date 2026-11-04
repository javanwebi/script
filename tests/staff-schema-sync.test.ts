import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const scriptPath='ops/sync-online-staff-schema-vps.sh';
const script=readFileSync(scriptPath,'utf8');

test('approved staff sync script passes Bash syntax and pins the exact migration',()=>{
 execFileSync('bash',['-n',scriptPath],{stdio:'pipe'});
 assert.match(script,/PINNED=2eafc2666407cd2ecdad22f3bc44e7a77af0bedd/);
 assert.match(script,/20261104100000_admin_staff_granular_permissions\.sql/);
 assert.match(script,/git show "\$PINNED:\$MIGRATION"/);
});

test('staff schema sync is opt-in, scoped and verifies real on-host PostgreSQL',()=>{
 assert.match(script,/--check\|--apply/);
 assert.match(script,/APP_CONTAINER_NOT_FOUND/);
 assert.match(script,/DIFFERENT_DATABASE_INSTANCE_ABORT/);
 assert.match(script,/STAFF_SCHEMA_PREFLIGHT_OK/);
 assert.match(script,/NO_CHANGES_MADE/);
 assert.doesNotMatch(script,/git reset --hard/);
});

test('schema application requires a restorable backup and protects existing data',()=>{
 const backup=script.indexOf('pg_dump --format=custom');
 const restore=script.indexOf('ISOLATED_SCHEMA_RESTORE_OK');
 const migration=script.indexOf('APPLY ONLY STAFF PERMISSION MIGRATION');
 assert.ok(backup>=0 && restore>backup && migration>restore);
 assert.match(script,/sha256sum -c/);
 assert.match(script,/pg_restore --schema-only --exit-on-error/);
 assert.match(script,/has_table_privilege/);
 assert.match(script,/STAFF_DB_INSTALL_OK/);
});

test('Postgres discovery accepts only supabase-db, not Supabase Postgres Meta',()=>{
 const matcher=String.raw`$1=="supabase-db" && $2 ~ /^supabase\/postgres:/ {print $1}`;
 const running = [
  'sanatpish-unified-live-20261104-205748-3434601 node:22-bookworm',
  'supabase-rest postgrest/postgrest:v14.18',
  'supabase-meta supabase/postgres-meta:v0.100.0',
  'supabase-db supabase/postgres:17.6.1.136',
  'supabase-auth supabase/gotrue:v2.197.0'
 ].join('\n')+'\n';
 assert.ok(script.includes("awk '"+matcher+"'"));
 const selected=execFileSync('awk',[matcher],{input:running,encoding:'utf8'}).trim().split('\n');
 assert.deepEqual(selected,['supabase-db']);
});
