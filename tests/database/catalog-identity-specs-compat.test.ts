import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'supabase/adopted/migrations/20261116010000_catalog_identity_specs_compat.sql';

test('catalog identity compatibility migration adds JSONB fields idempotently without changing existing SKU data', async () => {
  const db = new PGlite();
  try {
    await db.exec([
      'create table public.catalog_variants (',
      '  code text primary key,',
      '  family_code text not null,',
      '  name text not null,',
      "  technical_specs jsonb not null default '[]'::jsonb,",
      '  active boolean not null default true',
      ');',
      "insert into public.catalog_variants(code,family_code,name,technical_specs) values ('SKU-1','FAM-1','Existing belt','[{\"key\":\"profile\",\"value\":\"A\"}]'::jsonb);",
    ].join('\n'));

    const migration = await readFile(migrationPath, 'utf8');
    await db.exec(migration);
    await db.exec(migration);

    const columns = await db.query<{ column_name: string; data_type: string; column_default: string | null }>(
      "select column_name,data_type,column_default from information_schema.columns " +
      "where table_schema='public' and table_name='catalog_variants' " +
      "and column_name in ('identity_specs','variable_specs') order by column_name"
    );
    assert.deepEqual(columns.rows.map((row) => row.column_name), ['identity_specs', 'variable_specs']);
    for (const column of columns.rows) {
      assert.equal(column.data_type, 'jsonb');
      assert.match(column.column_default || '', /\{\}/);
    }

    const preserved = await db.query<{
      code: string;
      family_code: string;
      name: string;
      technical_specs: Array<{ key: string; value: string }>;
      identity_specs: Record<string, unknown>;
      variable_specs: Record<string, unknown>;
    }>(
      'select code,family_code,name,technical_specs,identity_specs,variable_specs ' +
      'from public.catalog_variants where code=$1',
      ['SKU-1']
    );
    assert.equal(preserved.rows.length, 1);
    assert.equal(preserved.rows[0].family_code, 'FAM-1');
    assert.equal(preserved.rows[0].name, 'Existing belt');
    assert.deepEqual(preserved.rows[0].technical_specs, [{ key: 'profile', value: 'A' }]);
    assert.deepEqual(preserved.rows[0].identity_specs, {});
    assert.deepEqual(preserved.rows[0].variable_specs, {});
  } finally {
    await db.close();
  }
});

test('production deploy applies catalog identity schema before the private canary and keeps diagnostics useful', async () => {
  const [deploy, baseline, canary] = await Promise.all([
    readFile('ops/deploy-single-port-vps.sh', 'utf8'),
    readFile('supabase/adopted/baseline/user_supplied_master.sql', 'utf8'),
    readFile('ops/verify-single-port-canary.mjs', 'utf8'),
  ]);

  const migration = deploy.indexOf('20261116010000_catalog_identity_specs_compat.sql');
  const ready = deploy.indexOf('PRODUCTION_CATALOG_IDENTITY_SCHEMA_READY');
  const canaryGate = deploy.indexOf("echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='");
  assert.ok(migration >= 0 && ready > migration && canaryGate > ready,
    'catalog identity columns must be migrated and verified before canary startup');

  assert.match(baseline, /identity_specs JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(baseline, /variable_specs JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(canary, /response\.clone\(\)\.text\(\)/,
    'failed canary API requests must include a bounded response body for diagnosis');
});
