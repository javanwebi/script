import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'ops/sql/20261116_belt_family_taxonomy_followup.sql';
const rollbackPath = 'ops/sql/20261116_belt_family_taxonomy_followup_rollback.sql';
const menuCorrectionPath = 'ops/sql/20261116_belt_family_menu_corrections.sql';
const aplFamily = 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576';
const brbCodes = ['34078', '41812'];
const timingCodes = ['10009','10036','10291','145022','34905','38264','39897','41554'];
const specialCodes = ['27843','27850','33969','37496','37985','38974','39183','41253'];
const unresolvedDirectCodes = [
  '34975','35712','41169','35023','42209','10264','31758','37621',
  '37731','38075','41278','41807','41814','58129','35236','38510'
];

const splitSqlValues = (line: string) => {
  const raw = line.trim().slice(1, line.lastIndexOf(')'));
  const fields: string[] = [];
  let current = '';
  let inQuote = false;
  for (const char of raw) {
    if (char === "'") {
      inQuote = !inQuote;
      current += char;
    } else if (char === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields.map((value) => value === 'null'
    ? null
    : value.startsWith("'") && value.endsWith("'")
      ? value.slice(1, -1)
      : value);
};

const readReviewedLists = async (migration: string, menuCorrection: string) => {
  const mappingEnd = ')' + String.fromCharCode(10) + 'update public.catalog_family_menu_assignments';
  const mappingBlock = migration
    .split('with mapping(family_code,category_slug,category_name,submenu_name,leaf_name) as (')[1]
    .split(mappingEnd)[0];
  const mappingRows = mappingBlock.split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter((line) => line.startsWith("('"))
    .map((line) => {
      const values = splitSqlValues(line);
      return {
        code: values[0] as string,
        categorySlug: values[1] as string,
        categoryName: values[2] as string,
        submenu: values[3] as string,
        leaf: values[4] as string | null,
      };
    });

  const preconditionBlock = migration.split('do $$')[1].split('end $$')[0];
  const familyCodeBlocks = preconditionBlock.split('where code in (').slice(1)
    .map((block) => block.split(') and is_active=true')[0]
      .split(',')
      .map((value) => value.trim().replaceAll("'", ''))
      .filter(Boolean));
  const unresolvedCodes = familyCodeBlocks[1];

  const staleBlock = menuCorrection.split('INSERT INTO _belt_family_unassign VALUES')[1]
    .split('CREATE TEMP TABLE _belt_direct_unassign')[0];
  const staleCodes = [...new Set(staleBlock.split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter((line) => line.startsWith("('"))
    .map((line) => splitSqlValues(line)[0] as string))];

  const directBlock = migration.split('-- Direct SKU: XPC is a narrow V-belt')[1].split('do $$')[0];
  const directCodes = [...new Set(directBlock.split("'")
    .filter((value) => value.length >= 4 && value.length <= 7
      && [...value].every((char) => char >= '0' && char <= '9')))];

  return { mappingRows, unresolvedCodes, staleCodes, directCodes };
};

test('belt taxonomy follow-up quarantines non-belt families, preserves every SKU and rolls back exactly', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  const rollback = await readFile(rollbackPath, 'utf8');
  const menuCorrection = await readFile(menuCorrectionPath, 'utf8');
  const { mappingRows, unresolvedCodes, staleCodes, directCodes } = await readReviewedLists(migration, menuCorrection);

  assert.equal(mappingRows.length, 31);
  assert.equal(unresolvedCodes.length, 22);
  assert.equal(staleCodes.length, 18);
  assert.equal(directCodes.length, 33);
  assert.ok(unresolvedCodes.includes(aplFamily));
  assert.equal(new Set([...mappingRows.map((row) => row.code), ...unresolvedCodes, ...staleCodes]).size, 71);

  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema internal;

      create table public.catalog_families (
        code text primary key,
        name text not null,
        category_slug text,
        category_name text,
        submenu text,
        subcategory text,
        materials text,
        profiles text,
        item_count integer not null default 0,
        is_active boolean not null default true,
        is_deleted boolean default false,
        updated_at timestamptz not null default now()
      );

      create table public.catalog_family_menu_assignments (
        family_code text primary key,
        category_slug text,
        submenu_name text,
        leaf_name text,
        method text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table public.catalog_direct_skus (
        sku_code text primary key,
        name text not null,
        category_slug text not null,
        category_name text not null,
        submenu text not null default '',
        subcategory text not null default '',
        technical_specs jsonb not null default '[]'::jsonb,
        is_active boolean not null default true,
        updated_at timestamptz not null default now()
      );

      create table public.catalog_variants (
        code text primary key,
        family_code text not null,
        active boolean not null default true,
        unit text,
        images jsonb not null default '[]'::jsonb
      );

      create table public.variant_commercial_specs (
        variant_code text primary key,
        price numeric,
        stock integer
      );
    `);

    const insertFamily = async (
      code: string,
      categorySlug: string,
      categoryName: string,
      submenu: string | null,
      subcategory: string | null,
      materials: string,
      profile: string
    ) => {
      await db.query(
        `insert into public.catalog_families
          (code,name,category_slug,category_name,submenu,subcategory,materials,profiles,item_count,is_active,is_deleted)
         values($1,$2,$3,$4,$5,$6,$7,$8,1,true,false)`,
        [code, `خانواده آزمایشی ${code}`, categorySlug, categoryName, submenu, subcategory, materials, profile]
      );
      await db.query(
        `insert into public.catalog_variants(code,family_code,active,unit,images)
         values($1,$2,true,'متر','["catalog.webp"]'::jsonb)`,
        [`SKU-${code}`, code]
      );
      await db.query(
        `insert into public.variant_commercial_specs(variant_code,price,stock)
         values($1,100,7)`,
        [`SKU-${code}`]
      );
    };

    for (const row of mappingRows) {
      await insertFamily(row.code, 'UNRESOLVED', 'نیازمند تعیین تکلیف', null, null, 'لاستیک/TPU', 'TEST');
      await db.query(
        `insert into public.catalog_family_menu_assignments
          (family_code,category_slug,submenu_name,leaf_name,method)
         values($1,'excel-v2-1-2','وی‌بلت متری',null,'admin_verified')`,
        [row.code]
      );
    }

    for (const code of unresolvedCodes) {
      await insertFamily(code, 'UNRESOLVED', 'نیازمند تعیین تکلیف', null, null, 'نامشخص', 'UNRESOLVED');
    }
    await db.query(
      `insert into public.catalog_family_menu_assignments
        (family_code,category_slug,submenu_name,leaf_name,method)
       values($1,'excel-v2-1-4','دستگاه‌های تسمه جوشی',null,'taxonomy_gap')`,
      [aplFamily]
    );

    for (const code of staleCodes) {
      await insertFamily(
        code,
        'excel-v2-1-2',
        'تسمه وی‌بلت (V-Belt)',
        'وی‌بلت متری',
        'تسمه A و B و C وی‌بلت متری',
        'پلی‌یورتان ترموپلاستیک قابل جوش حرارتی (TPU)',
        'A/B/C/BRB'
      );
    }

    const addDirect = async (
      code: string,
      categorySlug: string,
      categoryName: string,
      submenu: string,
      subcategory: string,
      profile: string
    ) => {
      await db.query(
        `insert into public.catalog_direct_skus
          (sku_code,name,category_slug,category_name,submenu,subcategory,technical_specs,is_active)
         values($1,$2,$3,$4,$5,$6,$7::jsonb,true)`,
        [
          code,
          `کالای مستقیم آزمایشی ${code}`,
          categorySlug,
          categoryName,
          submenu,
          subcategory,
          JSON.stringify([{ key: 'پروفیل / مدل', value: profile }]),
        ]
      );
    };

    await addDirect('41738','excel-v2-1-1','تسمه تایمینگ','سیم‌دار فابریک','پلی‌یورتان','XPC');
    for (const code of timingCodes) {
      await addDirect(code,'excel-v2-1-1','تسمه تایمینگ','سیم‌دار فابریک','پلی‌یورتان','DH');
    }
    for (const code of specialCodes) {
      await addDirect(code,'excel-v2-1-2','تسمه وی‌بلت (V-Belt)','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','5V');
    }
    for (const code of unresolvedDirectCodes) {
      await addDirect(code,'excel-v2-1-2','تسمه وی‌بلت (V-Belt)','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','UNRESOLVED');
    }
    for (const code of brbCodes) {
      await addDirect(code,'excel-v2-1-3','تسمه جوشی','تسمه فلت','انواع تسمه تخت و فلت','BRB');
    }

    const originalCounts = await db.query<{ families: number; assignments: number; direct: number; variants: number; commercial: number }>(
      `select
        (select count(*)::int from public.catalog_families) as families,
        (select count(*)::int from public.catalog_family_menu_assignments) as assignments,
        (select count(*)::int from public.catalog_direct_skus) as direct,
        (select count(*)::int from public.catalog_variants) as variants,
        (select count(*)::int from public.variant_commercial_specs) as commercial`
    );
    assert.deepEqual(originalCounts.rows[0], {
      families: 71, assignments: 32, direct: 35, variants: 71, commercial: 71,
    });

    await db.exec(migration);

    const mapped = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_family_menu_assignments
       where family_code=any($1::text[]) and method='engineering_audited'`,
      [mappingRows.map((row) => row.code)]
    );
    assert.equal(mapped.rows[0].count, 31);
    for (const row of mappingRows) {
      const actual = await db.query<{ category_slug: string; submenu_name: string; leaf_name: string | null; method: string }>(
        `select category_slug,submenu_name,leaf_name,method
         from public.catalog_family_menu_assignments where family_code=$1`,
        [row.code]
      );
      assert.deepEqual(actual.rows[0], {
        category_slug: row.categorySlug,
        submenu_name: row.submenu,
        leaf_name: row.leaf,
        method: 'engineering_audited',
      });
    }

    const apl = await db.query<{ assignments: number; category: string }>(
      `select
        (select count(*)::int from public.catalog_family_menu_assignments where family_code=$1) assignments,
        (select category_slug from public.catalog_families where code=$1) category`,
      [aplFamily]
    );
    assert.deepEqual(apl.rows[0], { assignments: 0, category: 'UNRESOLVED' });

    const quarantined = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_families
       where code=any($1::text[]) and category_slug='UNRESOLVED'
         and category_name='نیازمند تعیین تکلیف' and submenu is null and subcategory is null`,
      [unresolvedCodes]
    );
    assert.equal(quarantined.rows[0].count, 22);

    const staleFixed = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_families
       where code=any($1::text[]) and category_slug='UNRESOLVED'
         and category_name='نیازمند تعیین تکلیف' and submenu is null and subcategory is null`,
      [staleCodes]
    );
    assert.equal(staleFixed.rows[0].count, 18);

    const xpc = await db.query<{ category_slug: string; submenu: string; subcategory: string }>(
      `select category_slug,submenu,subcategory from public.catalog_direct_skus where sku_code='41738'`
    );
    assert.deepEqual(xpc.rows[0], {
      category_slug: 'excel-v2-1-2',
      submenu: 'تسمه اسپشیال',
      subcategory: 'SPA , SPB , SPC و دندانه‌دار',
    });

    const directUnresolved = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any($1::text[]) and category_slug='UNRESOLVED'`,
      [unresolvedDirectCodes]
    );
    assert.equal(directUnresolved.rows[0].count, 16);

    const brb = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any($1::text[]) and category_slug='UNRESOLVED'`,
      [brbCodes]
    );
    assert.equal(brb.rows[0].count, 2);

    const backup = await db.query<{ rows: number; rls: boolean }>(
      `select
        (select count(*)::int from internal.catalog_belt_taxonomy_followup_backup_20261116) rows,
        (select relrowsecurity from pg_class where relname='catalog_belt_taxonomy_followup_backup_20261116') rls`
    );
    assert.deepEqual(backup.rows[0], { rows: 138, rls: true });

    const afterCounts = await db.query<{ families: number; assignments: number; direct: number; variants: number; commercial: number }>(
      `select
        (select count(*)::int from public.catalog_families) as families,
        (select count(*)::int from public.catalog_family_menu_assignments) as assignments,
        (select count(*)::int from public.catalog_direct_skus) as direct,
        (select count(*)::int from public.catalog_variants) as variants,
        (select count(*)::int from public.variant_commercial_specs) as commercial`
    );
    assert.deepEqual(afterCounts.rows[0], {
      families: 71, assignments: 31, direct: 35, variants: 71, commercial: 71,
    });

    await db.exec(rollback);

    const rolledBackCounts = await db.query<{ assignments: number; direct: number; backup: number }>(
      `select
        (select count(*)::int from public.catalog_family_menu_assignments) assignments,
        (select count(*)::int from public.catalog_direct_skus) direct,
        (select count(*)::int from internal.catalog_belt_taxonomy_followup_backup_20261116) backup`
    );
    assert.deepEqual(rolledBackCounts.rows[0], { assignments: 32, direct: 35, backup: 138 });

    const restoredApl = await db.query<{ category_slug: string; submenu_name: string; method: string }>(
      `select category_slug,submenu_name,method from public.catalog_family_menu_assignments where family_code=$1`,
      [aplFamily]
    );
    assert.deepEqual(restoredApl.rows[0], {
      category_slug: 'excel-v2-1-4',
      submenu_name: 'دستگاه‌های تسمه جوشی',
      method: 'taxonomy_gap',
    });

    const restoredStale = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_families
       where code=any($1::text[]) and category_slug='excel-v2-1-2'
         and category_name='تسمه وی‌بلت (V-Belt)' and submenu='وی‌بلت متری'`,
      [staleCodes]
    );
    assert.equal(restoredStale.rows[0].count, 18);

    const restoredDirect = await db.query<{ category_slug: string; submenu: string; subcategory: string }>(
      `select category_slug,submenu,subcategory from public.catalog_direct_skus where sku_code='41738'`
    );
    assert.deepEqual(restoredDirect.rows[0], {
      category_slug: 'excel-v2-1-1',
      submenu: 'سیم‌دار فابریک',
      subcategory: 'پلی‌یورتان',
    });
  } finally {
    await db.close();
  }
});
