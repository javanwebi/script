import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'ops/sql/20261121_legacy_fam_belt_welding_direct_skus.sql';
const rollbackPath = 'ops/sql/20261121_legacy_fam_belt_welding_direct_skus_rollback.sql';

async function seedLegacyFamDatabase(options: { wrongWeldingSource?: boolean; mixedLineage?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(`
    create schema internal;
    create table public.catalog_categories (
      slug text primary key,
      name text not null,
      is_active boolean not null,
      metadata jsonb not null default '{}'::jsonb
    );
    create table public.catalog_families (
      code text primary key,
      is_active boolean not null,
      is_deleted boolean not null default false
    );
    create table public.catalog_variants (
      code text primary key,
      name text not null,
      family_code text not null,
      active boolean not null,
      brand text not null default '',
      technical_specs jsonb not null default '[]'::jsonb
    );
    create table public.catalog_direct_skus (
      sku_code text primary key,
      name text not null,
      category_slug text not null,
      category_name text not null,
      submenu text not null default '',
      subcategory text not null default '',
      brand text not null default '',
      image_url text,
      technical_specs jsonb not null default '[]'::jsonb,
      price_snapshot jsonb not null default '{}'::jsonb,
      source_family_code text,
      is_active boolean not null default true,
      updated_at timestamptz not null default now()
    );
    insert into public.catalog_categories(slug,name,is_active,metadata)
    values (
      'excel-v2-1-4',
      'تسمه بارکش و تجهیزات جوشی',
      true,
      '{"source":"industrial_megamenu_hierarchy_v2"}'::jsonb
    );
  `);

  const families = ['FAM-41497', 'FAM-35852', 'FAM-90062', 'FAM-OTHER'];
  if (options.mixedLineage) families.push('PFAM-TEST-ONLY');
  for (const code of families) {
    await db.query(
      'insert into public.catalog_families(code,is_active,is_deleted) values($1,true,false)',
      [code]
    );
  }

  const variants: Array<[string, string, string, string]> = [
    ['41497', 'دستگاه هویه آپارات (FORZA)', 'FAM-41497', 'FORZA'],
    ['35852', 'دستگاه گیره آپارات تسمه جوشی خارجی', 'FAM-35852', 'FOREIGN-OEM'],
    ['110049', 'دستگاه گیره آپارات تسمه جوشی تضمینی', options.wrongWeldingSource ? 'FAM-OTHER' : 'FAM-90062', 'GENERIC'],
    ['33140', 'نمونه کالای دیگر از خانواده منبع', 'FAM-90062', 'GENERIC'],
  ];
  for (const [code, name, familyCode, brand] of variants) {
    await db.query(
      'insert into public.catalog_variants(code,name,family_code,active,brand,technical_specs) values($1,$2,$3,true,$4,$5::jsonb)',
      [code, name, familyCode, brand, JSON.stringify([{ key: 'source', value: code }])]
    );
  }

  // Existing unresolved record: the migration must preserve its image/specs/price
  // snapshot and the rollback must restore its exact prior row.
  await db.query(
    `insert into public.catalog_direct_skus
      (sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,
       technical_specs,price_snapshot,source_family_code,is_active)
     values($1,$2,'UNRESOLVED','نیازمند تعیین تکلیف','','',$3,$4,$5::jsonb,$6::jsonb,$7,true)`,
    [
      '35852',
      'دستگاه گیره آپارات تسمه جوشی خارجی',
      'FOREIGN-OEM',
      '/catalog/source/35852.webp',
      JSON.stringify([{ key: 'preserved', value: 'technical-spec' }]),
      JSON.stringify({ preserved: 'commercial-snapshot' }),
      'FAM-35852',
    ]
  );

  return db;
}

test('legacy FAM welding equipment becomes three direct SKU menu records without changing families or variants; rollback is exact and repeatable', async () => {
  const db = await seedLegacyFamDatabase();
  try {
    const migration = await readFile(migrationPath, 'utf8');
    const rollback = await readFile(rollbackPath, 'utf8');

    const beforeFamilies = await db.query(
      'select * from public.catalog_families order by code'
    );
    const beforeVariants = await db.query(
      'select * from public.catalog_variants order by code'
    );

    await db.exec(migration);

    const assigned = await db.query<{
      sku_code: string;
      category_slug: string;
      submenu: string;
      subcategory: string;
      source_family_code: string;
      is_active: boolean;
    }>(
      `select sku_code,category_slug,submenu,subcategory,source_family_code,is_active
       from public.catalog_direct_skus
       where sku_code=any(array['41497','35852','110049']::text[])
       order by sku_code`
    );
    assert.deepEqual(assigned.rows, [
      {
        sku_code: '110049',
        category_slug: 'excel-v2-1-4',
        submenu: 'دستگاه‌های تسمه جوشی',
        subcategory: 'دستگاه جوش تسمه صنعتی',
        source_family_code: 'FAM-90062',
        is_active: true,
      },
      {
        sku_code: '35852',
        category_slug: 'excel-v2-1-4',
        submenu: 'دستگاه‌های تسمه جوشی',
        subcategory: 'دستگاه جوش تسمه صنعتی',
        source_family_code: 'FAM-35852',
        is_active: true,
      },
      {
        sku_code: '41497',
        category_slug: 'excel-v2-1-4',
        submenu: 'دستگاه‌های تسمه جوشی',
        subcategory: 'دستگاه جوش تسمه صنعتی',
        source_family_code: 'FAM-41497',
        is_active: true,
      },
    ]);

    const preserved = await db.query<{
      image_url: string | null;
      technical_specs: unknown;
      price_snapshot: unknown;
    }>(
      `select image_url,technical_specs,price_snapshot
       from public.catalog_direct_skus where sku_code='35852'`
    );
    assert.deepEqual(preserved.rows[0], {
      image_url: '/catalog/source/35852.webp',
      technical_specs: [{ key: 'preserved', value: 'technical-spec' }],
      price_snapshot: { preserved: 'commercial-snapshot' },
    });

    const backup = await db.query<{ rows: number; applied: number; previous_rows: number }>(
      `select count(*)::int as rows,
        count(*) filter(where migration_state='applied')::int as applied,
        count(*) filter(where previous_row is not null)::int as previous_rows
       from internal.catalog_legacy_fam_belt_welding_direct_backup_20261121`
    );
    assert.deepEqual(backup.rows[0], { rows: 3, applied: 3, previous_rows: 1 });

    // Idempotent redeploy must not add duplicates or rewrite the original snapshot.
    await db.exec(migration);
    const afterRepeat = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any(array['41497','35852','110049']::text[])
         and category_slug='excel-v2-1-4' and is_active=true`
    );
    assert.equal(afterRepeat.rows[0].count, 3);

    const afterFamilies = await db.query('select * from public.catalog_families order by code');
    const afterVariants = await db.query('select * from public.catalog_variants order by code');
    assert.deepEqual(afterFamilies.rows, beforeFamilies.rows);
    assert.deepEqual(afterVariants.rows, beforeVariants.rows);

    await db.exec(rollback);
    const afterRollback = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any(array['41497','35852','110049']::text[])`
    );
    assert.equal(afterRollback.rows[0].count, 1);

    const restored = await db.query<{ category_slug: string; image_url: string | null; price_snapshot: unknown }>(
      `select category_slug,image_url,price_snapshot
       from public.catalog_direct_skus where sku_code='35852'`
    );
    assert.deepEqual(restored.rows[0], {
      category_slug: 'UNRESOLVED',
      image_url: '/catalog/source/35852.webp',
      price_snapshot: { preserved: 'commercial-snapshot' },
    });

    const rollbackState = await db.query<{ rolled_back: number }>(
      `select count(*)::int as rolled_back
       from internal.catalog_legacy_fam_belt_welding_direct_backup_20261121
       where migration_state='rolled_back'`
    );
    assert.equal(rollbackState.rows[0].rolled_back, 3);

    // A second rollback is harmless, and the migration can be reapplied from
    // the same preserved pre-migration snapshot.
    await db.exec(rollback);
    await db.exec(migration);
    const reapplied = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any(array['41497','35852','110049']::text[])
         and category_slug='excel-v2-1-4' and is_active=true`
    );
    assert.equal(reapplied.rows[0].count, 3);

    const finalFamilies = await db.query('select * from public.catalog_families order by code');
    const finalVariants = await db.query('select * from public.catalog_variants order by code');
    assert.deepEqual(finalFamilies.rows, beforeFamilies.rows);
    assert.deepEqual(finalVariants.rows, beforeVariants.rows);
  } finally {
    await db.close();
  }
});

test('legacy FAM projection refuses an unexpected source-family mapping before writing direct SKUs', async () => {
  const db = await seedLegacyFamDatabase({ wrongWeldingSource: true });
  try {
    const migration = await readFile(migrationPath, 'utf8');
    await assert.rejects(
      db.exec(migration),
      /LEGACY_FAM_WELDING_SOURCE_VALIDATION_FAILED/
    );
    await db.exec('rollback');
    const direct = await db.query<{ count: number }>(
      'select count(*)::int as count from public.catalog_direct_skus where sku_code in (\'41497\',\'35852\',\'110049\')'
    );
    assert.equal(direct.rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('legacy FAM projection refuses mixed PFAM/FAM lineage without rewriting family rows', async () => {
  const db = await seedLegacyFamDatabase({ mixedLineage: true });
  try {
    const migration = await readFile(migrationPath, 'utf8');
    await assert.rejects(
      db.exec(migration),
      /LEGACY_FAM_WELDING_MIGRATION_REQUIRES_FAM_ONLY_LINEAGE/
    );
    await db.exec('rollback');
    const direct = await db.query<{ count: number }>(
      'select count(*)::int as count from public.catalog_direct_skus where sku_code in (\'41497\',\'35852\',\'110049\')'
    );
    assert.equal(direct.rows[0].count, 1);
  } finally {
    await db.close();
  }
});
