import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CATALOG_FAMILY_IDENTITY_LATERAL_SQL } from '../server/catalogFamilyIdentitySql';

test('legacy technical_specs supplies belt profile, material and product type when identity_specs is empty', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.catalog_families (
        code text primary key,
        name text not null,
        materials text
      );
      create table public.catalog_variants (
        code text primary key,
        family_code text not null,
        name text not null,
        active boolean not null default true,
        identity_specs jsonb not null default '{}'::jsonb,
        technical_specs jsonb not null default '[]'::jsonb
      );
      insert into public.catalog_families(code,name,materials) values
        ('FAM-LEGACY','Industrial V-belt',null),
        ('FAM-OVERRIDE','Industrial V-belt',null),
        ('FAM-MIXED','Industrial V-belt',null),
        ('FAM-PERSIAN','تسمه وی‌بلت',null),
        ('FAM-EMPTY','Industrial V-belt',null);
      insert into public.catalog_variants(code,family_code,name,identity_specs,technical_specs) values
        ('SKU-LEGACY','FAM-LEGACY','SPZ V-belt', '{}'::jsonb,
          '[{"key":"profile","value":"SPZ"},{"key":"material","value":"Rubber"},{"key":"productType","value":"V-Belt"}]'::jsonb),
        ('SKU-OVERRIDE','FAM-OVERRIDE','XPA V-belt',
          '{"profile":"XPA","material":"EPDM","productType":"V-Belt"}'::jsonb,
          '[{"key":"profile","value":"SPZ"},{"key":"material","value":"Rubber"},{"key":"productType","value":"Old type"}]'::jsonb),
        ('SKU-MIXED-A','FAM-MIXED','A profile belt', '{}'::jsonb,
          '[{"key":"profile","value":"A"},{"key":"material","value":"Rubber"}]'::jsonb),
        ('SKU-MIXED-B','FAM-MIXED','B profile belt', '{}'::jsonb,
          '[{"key":"profile","value":"B"},{"key":"material","value":"Rubber"}]'::jsonb),
        ('SKU-PERSIAN','FAM-PERSIAN','تسمه وی‌بلت پروفیل A', '{}'::jsonb,
          '[{"key":"پروفیل درج‌شده","value":"A"},{"key":"نوع قطعه","value":"تسمه وی‌بلت"}]'::jsonb),
        ('SKU-EMPTY','FAM-EMPTY','SPZ V-belt', '{"profile":"","material":"","productType":""}'::jsonb,
          '[{"key":"پروفیل / مدل","value":"SPZ"},{"key":"جنس و متریال","value":"PU"},{"key":"نوع محصول","value":"V-Belt"}]'::jsonb);
    `);

    const result = await db.query<{
      code: string;
      product_type: string | null;
      material: string | null;
      profile: string | null;
    }>(
      `select f.code,coalesce(identity.product_type,f.name) as product_type,identity.material,identity.profile
       from public.catalog_families f
       ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
       order by f.code`
    );

    assert.deepEqual(result.rows, [
      { code: 'FAM-EMPTY', product_type: 'V-Belt', material: 'PU', profile: 'SPZ' },
      { code: 'FAM-LEGACY', product_type: 'V-Belt', material: 'Rubber', profile: 'SPZ' },
      { code: 'FAM-MIXED', product_type: 'Industrial V-belt', material: 'Rubber', profile: 'MIXED' },
      { code: 'FAM-OVERRIDE', product_type: 'V-Belt', material: 'EPDM', profile: 'XPA' },
      { code: 'FAM-PERSIAN', product_type: 'تسمه وی‌بلت', material: null, profile: 'A' },
    ]);
  } finally {
    await db.close();
  }
});

test('every public and admin family resolver shares the legacy technical identity projection', async () => {
  const api = await readFile('server/catalogNavigationApi.ts', 'utf8');
  assert.match(api, /catalogFamilyIdentitySql/);
  assert.equal((api.match(/\$\{CATALOG_FAMILY_IDENTITY_LATERAL_SQL\}/g) || []).length, 6);
  assert.doesNotMatch(api, /from public\.catalog_variants v where v\.family_code=f\.code and v\.active=true\s*\) identity on true/);
  assert.match(api, /databaseAssignment&&assignmentMethod==='conservative_name_rule'/);
  assert.match(api, /return assignmentIsValid\(row,databaseAssignment\)\.valid\?databaseAssignment:null/);
  assert.ok(api.indexOf('const fallback=getFamilyMenuAssignment') < api.indexOf("if(databaseAssignment&&assignmentMethod==='conservative_name_rule')"), 'static audited mappings must precede conservative DB candidates');
});
