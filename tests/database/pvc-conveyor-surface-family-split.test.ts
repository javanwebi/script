import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'ops/sql/20261116_pvc_conveyor_surface_family_split.sql';
const rollbackPath = 'ops/sql/20261116_pvc_conveyor_surface_family_split_rollback.sql';
const genericFamily = 'PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';
const stoneFamily = 'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116';
const chickenFamily = 'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116';
const conicalFamily = 'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116';

test('PVC conveyor surface split is homogeneous, preserves SKU/commercial data and rolls back cleanly', async () => {
  const db = new PGlite();
  try {
    const schemaSql = [
      'create role anon;',
      'create role authenticated;',
      'create schema internal;',
      'create table public.catalog_categories (slug text primary key);',
      'create table public.catalog_families (',
      '  code text primary key, canonical_family_code text, source_row integer, name text not null, brand text,',
      '  category_slug text, category_name text, submenu text, subcategory text, profiles text, sizes_summary text,',
      '  unit text, item_count integer, materials text, filters_hint text, source_status text, description text,',
      '  has_catalogue_image boolean, image_scope text, images jsonb, technical_specs jsonb, tags jsonb,',
      '  correction_pages jsonb, is_deleted boolean, is_active boolean, override_version integer,',
      '  created_at timestamptz, updated_at timestamptz',
      ');',
      'create table public.catalog_family_menu_assignments (',
      '  family_code text primary key references public.catalog_families(code), category_slug text, submenu_name text,',
      '  leaf_name text, method text, created_at timestamptz, updated_at timestamptz',
      ');',
      'create table public.catalog_variants (',
      '  code text primary key, family_code text not null references public.catalog_families(code), name text not null,',
      '  size text, unit text, active boolean not null, reconstructed_family_code text, identity_specs jsonb,',
      '  variable_specs jsonb, technical_specs jsonb, technical_review jsonb, images jsonb, confidence_score integer,',
      '  updated_at timestamptz',
      ');',
      'create table public.variant_commercial_specs (',
      '  variant_code text primary key references public.catalog_variants(code),',
      '  family_code text not null references public.catalog_families(code), price numeric, base_price numeric,',
      '  stock integer, inquiry_only boolean, updated_at timestamptz',
      ');',
      'create table public.catalog_family_aliases (',
      '  old_family_code text, new_family_code text not null references public.catalog_families(code),',
      '  all_new_family_codes text[], updated_at timestamptz, primary key(old_family_code,new_family_code)',
      ');',
      'create table public.catalog_direct_skus (sku_code text primary key, is_active boolean not null default true);',
      "insert into public.catalog_categories(slug) values ('excel-v2-2-1');",
    ].join('\n');
    await db.exec(schemaSql);

    await db.query(
      'insert into public.catalog_families (' +
        'code,canonical_family_code,source_row,name,brand,category_slug,category_name,submenu,subcategory,' +
        'profiles,sizes_summary,unit,item_count,materials,filters_hint,source_status,description,' +
        'has_catalogue_image,image_scope,images,technical_specs,tags,correction_pages,' +
        'is_deleted,is_active,override_version,created_at,updated_at' +
      ') values ($1,$1,52858,$2,$3,$4,$5,$6,$7,$8,$9,$10,146,$11,null,$12,$13,false,null,$14::jsonb,$15::jsonb,$16::jsonb,null,false,true,1,now(),now())',
      [
        genericFamily,
        'نوار نقاله PVC | پروفیل ساده',
        '',
        'excel-v2-2-1',
        'نوار نقاله صنعتی',
        'بر اساس جنس',
        'نوار نقاله PVC',
        'CONVEYOR_PVC_SMOOTH',
        'سایزها',
        'حلقه',
        'پلی‌وینیل کلراید (PVC Conveyor Belt)',
        'reconstructed_phase1_v1',
        'legacy family',
        '[]',
        '[{"key":"profile","value":"CONVEYOR_PVC_SMOOTH"}]',
        '["نوار نقاله PVC"]',
      ]
    );

    await db.query(
      'insert into public.catalog_family_menu_assignments ' +
        '(family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at) ' +
        'values ($1,$2,$3,$4,$5,now(),now())',
      [genericFamily, 'excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC', 'admin_verified']
    );
    await db.query(
      'insert into public.catalog_family_aliases ' +
        '(old_family_code,new_family_code,all_new_family_codes,updated_at) values ($1,$2,$3::text[],now())',
      ['FAM-52858', genericFamily, [genericFamily, 'PFAM-PU-A', 'PFAM-PU-B', 'PFAM-MODULAR']]
    );

    const insertSku = async (code: string, name: string, unit: string, size: string) => {
      await db.query(
        'insert into public.catalog_variants ' +
          '(code,family_code,name,size,unit,active,reconstructed_family_code,identity_specs,variable_specs,technical_specs,technical_review,images,confidence_score) ' +
          'values($1,$2,$3,$4,$5,true,$2,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,95)',
        [
          code, genericFamily, name, size, unit,
          '{"profile":"CONVEYOR_PVC_SMOOTH","construction":"نوار نقاله PVC صنعتی (ساده)","standard":"ISO 21183 Light Conveyor"}',
          JSON.stringify({ profile: 'CONVEYOR_PVC_SMOOTH', construction: 'نوار نقاله PVC صنعتی (ساده)', standard: 'ISO 21183 Light Conveyor', unit: 'حلقه' }),
          '[{"key":"نوع قطعه","value":"نوار صنعتی"}]',
          '{"note":"legacy","researchWarnings":[]}',
          '[]',
        ]
      );
      await db.query(
        'insert into public.variant_commercial_specs ' +
          '(variant_code,family_code,price,base_price,stock,inquiry_only,updated_at) ' +
          'values($1,$2,100,90,5,false,now())',
        [code, genericFamily]
      );
    };

    for (let i = 1; i <= 114; i++) {
      const code = 'S' + String(i).padStart(3, '0');
      const unit = i <= 109 ? 'حلقه' : i <= 112 ? 'عدد' : i === 113 ? 'متر' : 'رول';
      await insertSku(code, 'نوار PVC سنگي ' + i, unit, '3*' + (600 + i) + '*' + (4000 + i));
    }

    for (let i = 1; i <= 3; i++) {
      await insertSku('C' + i, 'نوار PVC پامرغي ' + i, 'حلقه', '3*600*' + (4000 + i));
    }

    await insertSku('K1', 'نوار PVC كله قندي سوراخ دار 2200 * 4200', 'حلقه', '2200*4200');
    for (let i = 2; i <= 4; i++) {
      await insertSku('K' + i, 'نوار PVC كله قندي ' + (2200 + i) + ' * 4150', 'حلقه', (2200 + i) + '*4150');
    }

    for (let i = 1; i <= 25; i++) {
      const unit = i <= 23 ? 'حلقه' : i === 24 ? 'عدد' : 'متر';
      const name = i === 1 ? 'نوار PVC شفاف عرض 80CM' : 'نوار PVC سبز ' + i;
      await insertSku('U' + String(i).padStart(2, '0'), name, unit, '3*700*' + (5000 + i));
    }

    const original = await db.query<{ count: number }>(
      'select count(*)::int as count from public.catalog_variants where family_code=$1',
      [genericFamily]
    );
    assert.equal(original.rows[0].count, 146);

    await db.exec(await readFile(migrationPath, 'utf8'));

    const counts = await db.query<{ family_code: string; count: number }>(
      'select family_code,count(*)::int as count from public.catalog_variants group by family_code order by family_code'
    );
    const countByFamily = new Map(counts.rows.map((row) => [row.family_code, row.count]));
    assert.equal(countByFamily.get(stoneFamily), 114);
    assert.equal(countByFamily.get(chickenFamily), 3);
    assert.equal(countByFamily.get(conicalFamily), 4);
    assert.equal(countByFamily.get(genericFamily), 25);

    const consistency = await db.query<{
      total: number; units: number; images: number; commercial: number; profile: number; standards: number;
    }>(
      'select count(*)::int as total,' +
        "count(*) filter(where v.variable_specs->>'unit'=v.unit)::int as units," +
        "count(*) filter(where v.images='[]'::jsonb)::int as images," +
        'count(*) filter(where s.family_code=v.family_code and s.price=100 and s.base_price=90 and s.stock=5)::int as commercial,' +
        "count(*) filter(where v.identity_specs->>'profile' <> 'CONVEYOR_PVC_SMOOTH')::int as profile," +
        "count(*) filter(where v.identity_specs->>'standard'='NOT_ESTABLISHED')::int as standards " +
        'from public.catalog_variants v join public.variant_commercial_specs s on s.variant_code=v.code'
    );
    assert.deepEqual(consistency.rows[0], {
      total: 146, units: 146, images: 146, commercial: 146, profile: 146, standards: 146,
    });

    const familyUnits = await db.query<{ family_code: string; unit: string }>(
      'select code as family_code,unit from public.catalog_families where code=any($1::text[])',
      [[stoneFamily, genericFamily]]
    );
    const familyUnitMap = new Map(familyUnits.rows.map((row) => [row.family_code, row.unit]));
    assert.equal(familyUnitMap.get(stoneFamily), 'متنوع');
    assert.equal(familyUnitMap.get(genericFamily), 'متنوع');

    const conical = await db.query<{ profile: string; label: string }>(
      "select identity_specs->>'profile' as profile,variable_specs->>'surfaceTradeLabel' as label " +
        "from public.catalog_variants where code='K1'"
    );
    assert.equal(conical.rows[0].profile, 'PVC_CONICAL_CLEAT');
    assert.equal(conical.rows[0].label, 'کله‌قندی سوراخ‌دار');

    const unknown = await db.query<{ profile: string; confidence: number; warning: string }>(
      "select identity_specs->>'profile' as profile,confidence_score as confidence,technical_review->>'note' as warning " +
        "from public.catalog_variants where code='U01'"
    );
    assert.equal(unknown.rows[0].profile, 'PVC_SURFACE_UNSPECIFIED');
    assert.equal(unknown.rows[0].confidence, 70);
    assert.match(unknown.rows[0].warning, /الگوی سطح/);

    const alias = await db.query<{ all_new_family_codes: string[] }>(
      "select all_new_family_codes from public.catalog_family_aliases where old_family_code='FAM-52858'"
    );
    assert.ok(alias.rows[0].all_new_family_codes.includes(stoneFamily));
    assert.ok(alias.rows[0].all_new_family_codes.includes(chickenFamily));
    assert.ok(alias.rows[0].all_new_family_codes.includes(conicalFamily));

    const menu = await db.query<{ count: number }>(
      'select count(*)::int as count from public.catalog_family_menu_assignments ' +
        "where family_code=any($1::text[]) and category_slug='excel-v2-2-1' " +
        "and submenu_name='بر اساس جنس' and leaf_name='نوار نقاله PVC'",
      [[genericFamily, stoneFamily, chickenFamily, conicalFamily]]
    );
    assert.equal(menu.rows[0].count, 4);

    await db.exec(await readFile(rollbackPath, 'utf8'));

    const rolledBack = await db.query<{ total: number; old_profile: number; commercial: number }>(
      'select count(*)::int as total,' +
        "count(*) filter(where v.identity_specs->>'profile'='CONVEYOR_PVC_SMOOTH')::int as old_profile," +
        'count(*) filter(where s.family_code=v.family_code)::int as commercial ' +
        'from public.catalog_variants v join public.variant_commercial_specs s on s.variant_code=v.code ' +
        'where v.family_code=$1',
      [genericFamily]
    );
    assert.deepEqual(rolledBack.rows[0], { total: 146, old_profile: 146, commercial: 146 });

    const splitFamilies = await db.query<{ count: number }>(
      'select count(*)::int as count from public.catalog_families where code=any($1::text[])',
      [[stoneFamily, chickenFamily, conicalFamily]]
    );
    assert.equal(splitFamilies.rows[0].count, 0);

    const restoredAlias = await db.query<{ all_new_family_codes: string[] }>(
      "select all_new_family_codes from public.catalog_family_aliases where old_family_code='FAM-52858'"
    );
    assert.deepEqual(restoredAlias.rows[0].all_new_family_codes, [
      genericFamily, 'PFAM-PU-A', 'PFAM-PU-B', 'PFAM-MODULAR',
    ]);
  } finally {
    await db.close();
  }
});
